import SwiftUI
import CoreImage.CIFilterBuiltins
import VisionKit
import PuntentellerKit

/// Eigen uitnodigcode tonen, als cijfers en als QR-code. Een verlopen code
/// wordt vanzelf vervangen zolang de kaart in beeld is.
struct InviteCodeCard: View {
    @Environment(SyncEngine.self) private var sync
    @State private var invite: APIClient.InviteCodeResult?
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 10) {
            if let invite {
                // Altijd zwart op wit, zodat elke camera hem kan lezen.
                if let qr = QRCodeImage.make(InviteCode.qrPayload(invite.code)) {
                    Image(uiImage: qr)
                        .interpolation(.none)
                        .resizable()
                        .frame(width: 200, height: 200)
                        .padding(8)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                        .accessibilityLabel("QR-code")
                }
                Text(InviteCode.formatted(invite.code))
                    .font(Theme.display(34, weight: .bold))
                    .monospacedDigit()
                    .tracking(4)
                    .textSelection(.enabled)
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    let left = max(0, Int(invite.expiresAt.timeIntervalSince(context.date).rounded()))
                    Text("Nog \(left / 60):\(String(format: "%02d", left % 60)) geldig. Laat een medespeler deze code invullen of scannen bij Uitnodigen.")
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                        .multilineTextAlignment(.center)
                        .onChange(of: left == 0) { _, expired in if expired { renew() } }
                }
                Button("Nieuwe code", action: renew)
                    .disabled(busy)
            } else if let error {
                Text(error).foregroundStyle(Theme.negative)
                Button("Opnieuw proberen", action: renew)
            } else {
                ProgressView()
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .onAppear { if invite == nil { renew() } }
    }

    private func renew() {
        guard !busy else { return }
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                invite = try await sync.inviteCode()
            } catch {
                self.error = error.localizedDescription
                invite = nil
            }
        }
    }
}

enum QRCodeImage {
    static func make(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage,
              let cg = CIContext().createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

/// Camerabeeld dat zoekt naar een QR-code met een uitnodigcode.
struct InviteCodeScanner: View {
    let onCode: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    static var isAvailable: Bool {
        DataScannerViewController.isSupported && DataScannerViewController.isAvailable
    }

    var body: some View {
        NavigationStack {
            ScannerView { code in
                onCode(code)
                dismiss()
            }
            .ignoresSafeArea(edges: .bottom)
            .navigationTitle("Scan uitnodigcode")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annuleer") { dismiss() } }
            }
        }
    }
}

private struct ScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {}

    static func dismantleUIViewController(_ scanner: DataScannerViewController, coordinator: Coordinator) {
        scanner.stopScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onCode: onCode) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onCode: (String) -> Void
        private var done = false

        init(onCode: @escaping (String) -> Void) { self.onCode = onCode }

        func dataScanner(_ scanner: DataScannerViewController, didAdd items: [RecognizedItem], allItems: [RecognizedItem]) {
            for case .barcode(let barcode) in items {
                guard !done, let text = barcode.payloadStringValue, let code = InviteCode.parse(text) else { continue }
                done = true
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                onCode(code)
                return
            }
        }
    }
}

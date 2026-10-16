import SwiftUI
import UniformTypeIdentifiers
import PuntentellerKit

/// Uitkomst van een import, om te tonen in `ImportView`.
enum ImportResult: Equatable {
    case success(PWAImportSummary)
    case failure(String)
}

/// Spellen, spelers en profielen overzetten uit de web-app (PWA).
/// De iOS-app kan niet bij de opslag van Safari, dus de gebruiker exporteert
/// in de web-app een bestand en opent dat hier.
struct ImportView: View {
    @Environment(GameStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State var result: ImportResult?
    @State private var pickingFile = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let result {
                        resultCard(result)
                    }
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Zo zet je je spellen over")
                            .font(Theme.display(20))
                            .foregroundStyle(Theme.text)
                        step(1, "Open de Puntenteller-webapp in Safari of vanaf je beginscherm.")
                        step(2, "Tik op het tandwiel en kies **Exporteren naar iOS-app**.")
                        step(3, "Kies in het deelmenu **Puntenteller**, of **Bewaar in Bestanden** en kies het bestand hieronder.")
                        Text("Er wordt niets verwijderd. Je kunt het later nog eens doen: spellen komen niet dubbel binnen en spellen die je in de web-app verder gespeeld hebt, worden bijgewerkt.")
                            .font(.footnote)
                            .foregroundStyle(Theme.muted)
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                }
                .padding(20)
            }
            .background(Theme.bg)
            .safeAreaInset(edge: .bottom) {
                BottomBar {
                    Button { pickingFile = true } label: {
                        Label("Kies exportbestand", systemImage: "doc")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }
            }
            .navigationTitle("Importeren uit web-app")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Klaar") { dismiss() }
                }
            }
            .fileImporter(isPresented: $pickingFile, allowedContentTypes: [.json]) { picked in
                switch picked {
                case .success(let url):
                    result = Self.runImport(url, store: store)
                case .failure(let error):
                    result = .failure(error.localizedDescription)
                }
            }
            .sensoryFeedback(.success, trigger: result) { _, new in
                if case .success = new { true } else { false }
            }
        }
    }

    static func runImport(_ url: URL, store: GameStore) -> ImportResult {
        do {
            return .success(try store.importPWAExport(from: url))
        } catch {
            return .failure(error.localizedDescription)
        }
    }

    private func step(_ n: Int, _ text: LocalizedStringKey) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("\(n)")
                .font(Theme.display(14))
                .foregroundStyle(Theme.accentText)
                .frame(width: 26, height: 26)
                .background(Theme.accent, in: .circle)
            Text(text)
                .font(.system(size: 15))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private func resultCard(_ result: ImportResult) -> some View {
        switch result {
        case .success(let s):
            VStack(alignment: .leading, spacing: 6) {
                Label(s.isEmpty ? "Niets om te importeren" : "Import gelukt", systemImage: "checkmark.circle.fill")
                    .font(Theme.display(18))
                    .foregroundStyle(Theme.positive)
                ForEach(Self.lines(for: s), id: \.self) { line in
                    Text(line)
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.text)
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
        case .failure(let message):
            VStack(alignment: .leading, spacing: 6) {
                Label("Import mislukt", systemImage: "exclamationmark.triangle.fill")
                    .font(Theme.display(18))
                    .foregroundStyle(Theme.negative)
                Text(message)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.text)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
        }
    }

    static func lines(for s: PWAImportSummary) -> [String] {
        var lines: [String] = []
        func add(_ n: Int, _ one: String, _ many: String) {
            if n > 0 { lines.append("\(n) \(n == 1 ? one : many)") }
        }
        add(s.gamesAdded, "spel toegevoegd", "spellen toegevoegd")
        add(s.gamesUpdated, "spel bijgewerkt", "spellen bijgewerkt")
        add(s.gamesUnchanged, "spel was al aanwezig", "spellen waren al aanwezig")
        add(s.playersAdded, "speler toegevoegd", "spelers toegevoegd")
        add(s.profilesAdded, "spelprofiel toegevoegd", "spelprofielen toegevoegd")
        return lines
    }
}

#Preview("Resultaat") {
    ImportView(result: .success(PWAImportSummary(gamesAdded: 4, profilesAdded: 2, playersAdded: 6)))
        .environment(GameStore(fileURL: nil))
}

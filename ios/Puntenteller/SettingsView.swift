import SwiftUI

/// Voorkeuren op dit toestel (zie `SettingsSheet.tsx`). Worden niet gesynct.
enum Preferences {
    static let keepAwake = "keepAwake"
}

/// Instellingen: scherm aan houden en importeren uit de web-app.
struct SettingsView: View {
    let onImport: () -> Void

    @AppStorage(Preferences.keepAwake) private var keepAwake = false
    @Environment(SyncEngine.self) private var sync
    @Environment(\.dismiss) private var dismiss
    @State private var showAccount = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button { showAccount = true } label: {
                        row(
                            "person.crop.circle",
                            sync.account?.displayName ?? "Account",
                            sync.account.map { "Ingelogd als \($0.email)" } ?? "Spellen delen met medespelers en op al je toestellen"
                        )
                    }
                    .foregroundStyle(Theme.text)
                }
                Section {
                    Toggle(isOn: $keepAwake) {
                        row("sun.max", "Scherm aan houden", "Voorkomt dat het scherm tijdens het spelen uitgaat")
                    }
                    .tint(Theme.positive)
                }
                Section {
                    Button {
                        dismiss()
                        onImport()
                    } label: {
                        row("square.and.arrow.down", "Importeren uit web-app", "Zet je spellen, spelers en profielen over uit de web-app")
                    }
                    .foregroundStyle(Theme.text)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Instellingen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Klaar") { dismiss() }
                }
            }
            .sheet(isPresented: $showAccount) { AccountView() }
        }
    }

    private func row(_ symbol: String, _ title: String, _ subtitle: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 19))
                .foregroundStyle(Theme.accent)
                .frame(width: 40, height: 40)
                .background(Theme.surface2, in: .rect(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(Theme.display(16))
                Text(subtitle)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.muted)
            }
        }
    }
}

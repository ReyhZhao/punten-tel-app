import SwiftUI
import PuntentellerKit

/// Een speler uitnodigen door zijn account te zoeken op e-mailadres.
struct InviteSheet: View {
    let playerName: String
    let accountId: String?
    let onChange: (String?) -> Void

    @Environment(SyncEngine.self) private var sync
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var found: APIClient.LookupResult?
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                if accountId != nil && found == nil {
                    Section {
                        Label("\(playerName) is uitgenodigd", systemImage: "person.crop.circle.badge.checkmark")
                            .foregroundStyle(Theme.positive)
                        Button("Uitnodiging intrekken", role: .destructive) {
                            onChange(nil)
                            dismiss()
                        }
                    }
                }
                Section {
                    TextField("E-mailadres van \(playerName)", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.search)
                        .onSubmit(search)
                } footer: {
                    Text("Vul het volledige e-mailadres in waarmee \(playerName) een Puntenteller-account heeft. Na uitnodigen ziet \(playerName) dit spel en de uitslag in de eigen app.")
                }
                Section {
                    if let found {
                        Label("Gevonden: \(found.displayName)", systemImage: "person.fill.checkmark")
                            .foregroundStyle(Theme.positive)
                            .listRowBackground(Color.clear)
                        Button("\(playerName) koppelen aan \(found.displayName)") {
                            onChange(found.id.lowercased())
                            dismiss()
                        }
                        .formPrimaryButton()
                    } else {
                        Button(action: search) {
                            HStack(spacing: 8) {
                                if busy { ProgressView().tint(Theme.accentText) }
                                Text("Zoeken")
                            }
                        }
                        .formPrimaryButton()
                        .disabled(email.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                    }
                }
                if let error {
                    Section { Text(error).foregroundStyle(Theme.negative) }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("\(playerName) uitnodigen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annuleer") { dismiss() } }
            }
        }
    }

    private func search() {
        error = nil
        found = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                found = try await sync.lookup(email: email.trimmingCharacters(in: .whitespaces))
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

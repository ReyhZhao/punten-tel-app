import SwiftUI
import PuntentellerKit

/// Account aanmaken of inloggen met een code per e-mail, en daarna het account
/// beheren (ADR-0003). Een account is optioneel; zonder werkt alles lokaal.
struct AccountView: View {
    @Environment(SyncEngine.self) private var sync
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let account = sync.account {
                    SignedInView(account: account)
                } else {
                    SignInFlow()
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Klaar") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Inloggen / aanmelden

private struct SignInFlow: View {
    private enum Step { case email, code }

    @Environment(SyncEngine.self) private var sync
    @State private var step = Step.email
    @State private var email = ""
    @State private var displayName = ""
    @State private var needsName = false
    @State private var code = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focus: Field?

    private enum Field { case email, name, code }

    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespaces) }

    var body: some View {
        Form {
            switch step {
            case .email: emailStep
            case .code: codeStep
            }
            if let error {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.negative)
                }
            }
        }
        .disabled(busy)
        .onAppear { focus = .email }
    }

    @ViewBuilder private var emailStep: some View {
        Section {
            TextField("E-mailadres", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focus, equals: .email)
                .submitLabel(needsName ? .next : .send)
                .onSubmit { needsName ? (focus = .name) : send() }
            if needsName {
                TextField("Schermnaam", text: $displayName)
                    .textContentType(.nickname)
                    .focused($focus, equals: .name)
                    .submitLabel(.send)
                    .onSubmit(send)
            }
        } header: {
            Text(needsName ? "Nieuw account" : "Inloggen of account aanmaken")
        } footer: {
            Text(needsName
                 ? "Je schermnaam zien medespelers als je ze uitnodigt. Je krijgt een code per e-mail om je adres te bevestigen."
                 : "Met een account kun je spellen delen met medespelers en op meerdere toestellen gebruiken. Je krijgt een code per e-mail; een wachtwoord is niet nodig.")
        }
        Section {
            Button(action: send) {
                HStack(spacing: 8) {
                    if busy { ProgressView().tint(Theme.accentText) }
                    Text(needsName ? "Account aanmaken" : "Stuur code")
                }
            }
            .formPrimaryButton()
            .disabled(busy || trimmedEmail.isEmpty || (needsName && displayName.trimmingCharacters(in: .whitespaces).isEmpty))
        }
    }

    @ViewBuilder private var codeStep: some View {
        Section {
            TextField("123456", text: $code)
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .font(Theme.display(28, weight: .bold))
                .monospacedDigit()
                .focused($focus, equals: .code)
                .onChange(of: code) { _, new in
                    code = String(new.filter(\.isNumber).prefix(6))
                    if code.count == 6 { verify() }
                }
        } header: {
            Text("Code uit de e-mail")
        } footer: {
            Text("We hebben een code van 6 cijfers gestuurd naar \(trimmedEmail). De code is 15 minuten geldig.")
        }
        Section {
            Button(action: verify) {
                HStack(spacing: 8) {
                    if busy { ProgressView().tint(Theme.accentText) }
                    Text("Bevestigen")
                }
            }
            .formPrimaryButton()
            .disabled(busy || code.count != 6)
        }
        Section {
            Button("Nieuwe code sturen", action: send)
            Button("Ander e-mailadres") {
                step = .email
                code = ""
                error = nil
            }
        }
    }

    private func send() {
        error = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                let name = needsName ? displayName.trimmingCharacters(in: .whitespaces) : nil
                _ = try await sync.requestCode(email: trimmedEmail, displayName: name)
                step = .code
                code = ""
                focus = .code
            } catch let e as APIError where e.code == "account_not_found" {
                // Nieuw e-mailadres: vraag om een schermnaam.
                needsName = true
                focus = .name
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private func verify() {
        guard code.count == 6, !busy else { return }
        error = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                try await sync.verify(email: trimmedEmail, code: code)
            } catch {
                self.error = error.localizedDescription
                code = ""
            }
        }
    }
}

// MARK: - Ingelogd

private struct SignedInView: View {
    let account: Account

    @Environment(SyncEngine.self) private var sync
    @State private var name = ""
    @State private var confirmDelete = false
    @State private var showInviteCode = false
    @State private var error: String?

    var body: some View {
        Form {
            Section {
                LabeledContent("E-mail", value: account.email)
                TextField("Schermnaam", text: $name)
                    .onSubmit(saveName)
                    .submitLabel(.done)
            } footer: {
                Text("Medespelers vinden je via je e-mailadres of je uitnodigcode en zien je schermnaam.")
            }

            Section {
                if showInviteCode {
                    InviteCodeCard()
                } else {
                    Button("Toon mijn uitnodigcode", systemImage: "qrcode") { showInviteCode = true }
                }
            }

            Section {
                Button {
                    Task { await sync.syncNow() }
                } label: {
                    HStack {
                        Label("Nu synchroniseren", systemImage: "arrow.triangle.2.circlepath")
                        Spacer()
                        if sync.status == .syncing { ProgressView() }
                    }
                }
                switch sync.status {
                case .failed(let message):
                    Label(message, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.negative)
                default:
                    if let last = sync.lastSyncAt {
                        Text("Laatst gesynchroniseerd: \(last.relativeNL)")
                            .foregroundStyle(Theme.muted)
                    }
                }
            }

            if let error {
                Section { Text(error).foregroundStyle(Theme.negative) }
            }

            Section {
                Button("Uitloggen") { Task { await sync.signOut() } }
                Button("Account verwijderen", role: .destructive) { confirmDelete = true }
            } footer: {
                Text("Na uitloggen blijven je spellen op dit toestel staan.")
            }
        }
        .onAppear { name = account.displayName }
        .confirmationDialog("Account verwijderen?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Verwijderen", role: .destructive) {
                Task {
                    do { try await sync.deleteAccount() } catch { self.error = error.localizedDescription }
                }
            }
        } message: {
            Text("Je account en je gedeelde spellen worden van de server verwijderd. Medespelers zien je spellen dan niet meer. Op dit toestel blijven ze staan.")
        }
    }

    private func saveName() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, trimmed != account.displayName else { return }
        Task {
            do { try await sync.updateDisplayName(trimmed) } catch { self.error = error.localizedDescription }
        }
    }
}

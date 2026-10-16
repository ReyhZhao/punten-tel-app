import SwiftUI
import PuntentellerKit

/// Eigenaar van een lopend spel: spelers uitnodigen, iedereen laten scoren en
/// het spel overdragen aan een andere speler (ADR-0003).
struct SharingView: View {
    let gameId: UUID

    @Environment(GameStore.self) private var store
    @Environment(SyncEngine.self) private var sync
    @Environment(\.dismiss) private var dismiss
    @State private var invitingPlayerId: UUID?
    @State private var newOwnerId: String?
    @State private var ownPlayerId: UUID?
    @State private var confirmTransfer = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if let game = store.game(gameId) {
                    form(game)
                } else {
                    ContentUnavailableView("Spel niet gevonden", systemImage: "questionmark.circle")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Spelers en delen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Klaar") { dismiss() } }
            }
        }
        .sheet(item: Binding(
            get: { invitingPlayerId.flatMap { id in store.game(gameId)?.players.first { $0.id == id } } },
            set: { if $0 == nil { invitingPlayerId = nil } }
        )) { player in
            InviteSheet(playerName: player.name, accountId: player.accountId) { accountId in
                store.linkPlayer(player.id, to: accountId, in: gameId)
            }
            .presentationDetents([.medium])
        }
    }

    @ViewBuilder
    private func form(_ game: Game) -> some View {
        // Zonder account is er geen "jij" (anders zou elke niet-gekoppelde speler matchen).
        let me = sync.accountId
        let myPlayer = me.flatMap { me in game.players.first { $0.accountId == me } }
        let candidates = game.players.filter { $0.accountId != nil && $0.accountId != me }

        Form {
            Section {
                ForEach(game.players) { player in
                    playerRow(player, me: me, canClaim: myPlayer == nil)
                }
            } header: {
                Text("Spelers")
            } footer: {
                Text("Uitgenodigde spelers zien dit spel en de stand in hun eigen app.")
            }

            Section {
                Toggle("Alle spelers mogen scores invoeren", isOn: Binding(
                    get: { game.participantsCanScore },
                    set: { store.setParticipantsCanScore($0, in: gameId) }
                ))
                .tint(Theme.positive)
            } footer: {
                Text("Uitgenodigde spelers kunnen dan ook punten boeken en boekingen ongedaan maken.")
            }

            Section {
                if candidates.isEmpty {
                    Text("Nodig eerst een speler uit; daarna kun je het spel aan die speler overdragen.")
                        .foregroundStyle(Theme.muted)
                } else {
                    Picker("Nieuwe eigenaar", selection: $newOwnerId) {
                        Text("Kies een speler").tag(String?.none)
                        ForEach(candidates) { p in
                            Text(p.name).tag(p.accountId)
                        }
                    }
                    if myPlayer == nil {
                        Picker("Welke speler ben jij?", selection: $ownPlayerId) {
                            Text("Kies").tag(UUID?.none)
                            ForEach(game.players.filter { $0.accountId == nil }) { p in
                                Text(p.name).tag(Optional(p.id))
                            }
                        }
                    }
                    Button {
                        confirmTransfer = true
                    } label: {
                        HStack(spacing: 8) {
                            if busy { ProgressView().tint(Theme.accentText) }
                            Text("Eigenaar overdragen")
                        }
                    }
                    .formPrimaryButton()
                    .disabled(busy || newOwnerId == nil || (myPlayer == nil && ownPlayerId == nil))
                }
                if let error {
                    Text(error).foregroundStyle(Theme.negative)
                }
            } header: {
                Text("Eigenaar overdragen")
            } footer: {
                Text("De nieuwe eigenaar beheert daarna het spel en de spelers. Jij blijft meespelen en ziet de stand.")
            }
        }
        .confirmationDialog(
            "Spel overdragen aan \(candidates.first { $0.accountId == newOwnerId }?.name ?? "deze speler")?",
            isPresented: $confirmTransfer, titleVisibility: .visible
        ) {
            Button("Overdragen") { transfer() }
        } message: {
            Text("Je kunt dit niet zelf terugdraaien; de nieuwe eigenaar kan het spel wel weer aan jou overdragen.")
        }
    }

    private func playerRow(_ player: Player, me: String?, canClaim: Bool) -> some View {
        HStack(spacing: 12) {
            PlayerAvatar(player, size: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(player.name).font(Theme.display(16)).foregroundStyle(Theme.text)
                if let account = player.accountId {
                    Text(me != nil && account == me ? "Jij" : "Uitgenodigd: \(store.accountName(account) ?? player.name)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.positive)
                }
            }
            Spacer()
            Menu {
                if player.accountId == nil {
                    Button("Uitnodigen…", systemImage: "envelope") { invitingPlayerId = player.id }
                    if canClaim && me != nil {
                        Button("Dit ben ik", systemImage: "person.fill") { store.linkPlayer(player.id, to: me, in: gameId) }
                    }
                } else {
                    Button(player.accountId == me ? "Niet meer mij" : "Uitnodiging intrekken",
                           systemImage: "person.crop.circle.badge.xmark", role: .destructive) {
                        store.linkPlayer(player.id, to: nil, in: gameId)
                    }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.system(size: 20))
                    .foregroundStyle(Theme.accent)
                    .frame(width: 36, height: 36)
            }
            .accessibilityLabel("Opties voor \(player.name)")
        }
    }

    private func transfer() {
        guard let newOwnerId else { return }
        error = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                try await sync.transfer(gameId, to: newOwnerId, ownerPlayerId: ownPlayerId)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

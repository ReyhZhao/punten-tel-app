import SwiftUI
import PuntentellerKit

/// Bewaarde spelers op aantal overwinningen, totaal of per spelprofiel
/// (zie `screens/PlayersScreen.tsx`).
struct PlayersView: View {
    @Environment(GameStore.self) private var store
    @Environment(SyncEngine.self) private var sync
    @AppStorage(Preferences.myPlayerId) private var myPlayerId = ""
    @Environment(\.dismiss) private var dismiss
    /// nil = totaal over alle spellen.
    @State private var profileId: UUID?

    var body: some View {
        let board = store.leaderboard(profileId: profileId)
        let topWins = board.first?.wins ?? 0
        let me = store.mySavedPlayer(id: myPlayerId, accountId: sync.accountId)

        VStack(spacing: 0) {
            ZStack {
                Text("Spelers")
                    .font(Theme.display(18))
                    .foregroundStyle(Theme.text)
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Theme.text)
                            .frame(width: 40, height: 40)
                    }
                    .accessibilityLabel("Terug")
                    Spacer()
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)

            if !store.profiles.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        scopeChip("Totaal", id: nil)
                        ForEach(store.profiles) { scopeChip($0.name, id: $0.id) }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 6)
                }
            }

            if board.isEmpty {
                ContentUnavailableView {
                    Label("Nog geen spelers", systemImage: "person")
                } description: {
                    Text("Spelers worden automatisch opgeslagen zodra je een spel aanmaakt.")
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 9) {
                        mePicker(me)
                        SectionLabel("\(board.count) \(board.count == 1 ? "speler" : "spelers")")
                            .padding(.leading, 4)
                        ForEach(Array(board.enumerated()), id: \.element.player.id) { i, entry in
                            row(rank: i + 1, entry.player, wins: entry.wins, isLeader: entry.wins > 0 && entry.wins == topWins,
                                isMe: entry.player.id == me?.id)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .animation(.snappy, value: board.map(\.player.id))
                }
            }
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Theme.bg)
        .toolbar(.hidden, for: .navigationBar)
    }

    private func scopeChip(_ title: String, id: UUID?) -> some View {
        let active = profileId == id
        return Button { profileId = id } label: {
            Text(title)
                .font(Theme.display(14))
                .foregroundStyle(active ? Theme.accentText : Theme.text)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(active ? Theme.accent : Theme.surface2, in: .capsule)
        }
        .buttonStyle(.plain)
    }

    /// Wie ben jij? Die speler staat daarna meteen in elk nieuw spel.
    private func mePicker(_ me: SavedPlayer?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            SectionLabel("Wie ben jij?")
                .padding(.leading, 4)
            Menu {
                Picker("Wie ben jij?", selection: Binding(
                    get: { me?.id.uuidString ?? "" },
                    set: { myPlayerId = $0 }
                )) {
                    Text("Niet ingesteld").tag("")
                    ForEach(store.savedPlayers.sorted { $0.name.localizedCompare($1.name) == .orderedAscending }) {
                        Text($0.name).tag($0.id.uuidString)
                    }
                }
            } label: {
                HStack {
                    Text(me?.name ?? "Niet ingesteld")
                        .font(Theme.display(17))
                        .foregroundStyle(me == nil ? Theme.muted : Theme.text)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .card(radius: Theme.Radius.row)
            }
            Text("Deze speler staat automatisch in elk nieuw spel.")
                .font(.footnote)
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 4)
        }
        .padding(.bottom, 8)
    }

    private func row(rank: Int, _ player: SavedPlayer, wins: Int, isLeader: Bool, isMe: Bool) -> some View {
        HStack(spacing: 12) {
            Text("\(rank)")
                .font(Theme.display(15))
                .foregroundStyle(Theme.muted)
                .frame(width: 22)
            PlayerAvatar(name: player.name, color: player.color, size: 40)
                .overlay(alignment: .topTrailing) {
                    if isLeader {
                        Image(systemName: "trophy.fill")
                            .font(.system(size: 9))
                            .foregroundStyle(.white)
                            .frame(width: 18, height: 18)
                            .background(Theme.gold, in: .circle)
                            .overlay(Circle().strokeBorder(Theme.surface, lineWidth: 2))
                            .offset(x: 5, y: -5)
                    }
                }
            VStack(alignment: .leading, spacing: 1) {
                Text(player.name)
                    .font(Theme.display(17))
                    .foregroundStyle(Theme.text)
                if isMe {
                    Text("Jij")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                }
            }
            Spacer()
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(wins)")
                    .font(Theme.display(22, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(isLeader ? Theme.accent : Theme.text)
                Text(wins == 1 ? "win" : "wins")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.muted)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .card(radius: Theme.Radius.row)
        .accessibilityElement(children: .combine)
    }
}

#Preview {
    NavigationStack { PlayersView() }
        .environment(GameStore.preview)
        .environment(SyncEngine(store: GameStore.preview))
}

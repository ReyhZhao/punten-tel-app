import SwiftUI
import PuntentellerKit

/// Bewaarde spelers op aantal overwinningen, totaal of per spelprofiel
/// (zie `screens/PlayersScreen.tsx`).
struct PlayersView: View {
    @Environment(GameStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    /// nil = totaal over alle spellen.
    @State private var profileId: UUID?

    var body: some View {
        let board = store.leaderboard(profileId: profileId)
        let topWins = board.first?.wins ?? 0

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
                        SectionLabel("\(board.count) \(board.count == 1 ? "speler" : "spelers")")
                            .padding(.leading, 4)
                        ForEach(Array(board.enumerated()), id: \.element.player.id) { i, entry in
                            row(rank: i + 1, entry.player, wins: entry.wins, isLeader: entry.wins > 0 && entry.wins == topWins)
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

    private func row(rank: Int, _ player: SavedPlayer, wins: Int, isLeader: Bool) -> some View {
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
            Text(player.name)
                .font(Theme.display(17))
                .foregroundStyle(Theme.text)
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
}

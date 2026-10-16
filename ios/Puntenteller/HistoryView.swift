import SwiftUI
import PuntentellerKit

/// Alle boekingen van een spel, nieuwste eerst, met undo per boeking
/// (zie `game/HistorySheet.tsx`).
struct HistoryView: View {
    let game: Game
    let onUndo: (UUID) -> Void

    @Environment(\.dismiss) private var dismiss

    private var entries: [ScoreEntry] { game.activeLog.reversed() }

    var body: some View {
        NavigationStack {
            Group {
                if entries.isEmpty {
                    ContentUnavailableView {
                        Label("Nog geen punten geboekt.", systemImage: "list.bullet")
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 7) {
                            ForEach(entries) { entry in
                                if let player = game.players.first(where: { $0.id == entry.playerId }) {
                                    row(entry, player: player)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 6)
                        .animation(.snappy, value: entries.map(\.id))
                    }
                }
            }
            .background(Theme.bg)
            .navigationTitle("Historie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Sluiten", systemImage: "xmark") { dismiss() }
                }
            }
        }
    }

    private func row(_ entry: ScoreEntry, player: Player) -> some View {
        HStack(spacing: 12) {
            PlayerAvatar(player, size: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text(player.name)
                    .font(Theme.display(16))
                    .foregroundStyle(Theme.text)
                Text(entry.createdAt.relativeNL)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.muted)
            }
            Spacer()
            Text(entry.delta >= 0 ? "+\(entry.delta)" : entry.delta.signedString)
                .font(Theme.display(19, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(entry.delta >= 0 ? Theme.positive : Theme.negative)
            Button { onUndo(entry.id) } label: {
                Image(systemName: "arrow.uturn.backward")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                    .frame(width: 36, height: 36)
            }
            .accessibilityLabel("Ongedaan maken")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .card(radius: 16)
        .transition(.opacity)
    }
}

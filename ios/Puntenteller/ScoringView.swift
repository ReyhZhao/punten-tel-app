import SwiftUI
import PuntentellerKit

/// Kernscherm: punten op- en aftellen per speler (zie `screens/ScoringScreen.tsx`).
/// Nog niet geport: timer, historie-sheet, zwevende +N en het winnaarscherm met
/// podium (docs/ios-port.md). Een afgerond spel toont voorlopig een winnaarskaart.
struct ScoringView: View {
    let gameId: UUID

    @Environment(GameStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var amount: Int? = 1
    @State private var selectedId: UUID?
    @State private var confirmFinish = false
    @FocusState private var amountFocused: Bool

    var body: some View {
        if let game = store.game(gameId) {
            content(game)
        } else {
            ContentUnavailableView("Spel niet gevonden", systemImage: "questionmark.circle")
        }
    }

    private func content(_ game: Game) -> some View {
        let selected = game.players.first { $0.id == selectedId } ?? game.players.first

        return VStack(spacing: 0) {
            header(game)
            ScrollView {
                VStack(spacing: 10) {
                    if game.isFinished {
                        winnerCard(game)
                    } else {
                        if let selected { controlCard(game, selected: selected) }
                        if let left = game.endTurnsLeft {
                            Label("Max bereikt — nog \(left) \(left == 1 ? "beurt" : "beurten")", systemImage: "flag.checkered")
                                .font(Theme.display(14))
                                .foregroundStyle(Theme.text)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 9)
                                .background(Theme.gold.opacity(0.22), in: .capsule)
                        }
                    }
                    ForEach(game.displayOrder) { player in
                        PlayerRow(
                            player: player,
                            score: game.score(of: player.id),
                            isSelected: !game.isFinished && player.id == selected?.id,
                            isLeader: game.leaders.contains { $0.id == player.id },
                            reachedMax: game.rules.maxScore.map { game.score(of: player.id) >= $0 } ?? false
                        )
                        .onTapGesture { if !game.isFinished { selectedId = player.id } }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
                .animation(.snappy, value: game.displayOrder.map(\.id))
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Theme.bg)
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.impact(weight: .light), trigger: game.activeLog.count)
        .sensoryFeedback(.success, trigger: game.isFinished) { _, finished in finished }
        .confirmationDialog("Spel beëindigen?", isPresented: $confirmFinish, titleVisibility: .visible) {
            Button("Beëindigen", role: .destructive) { store.finish(game.id) }
        } message: {
            Text("De huidige stand wordt de uitslag.")
        }
    }

    // MARK: - Onderdelen

    private func header(_ game: Game) -> some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 40)
            }
            .accessibilityLabel("Terug")
            Spacer()
            VStack(spacing: 1) {
                Text(game.name)
                    .font(Theme.display(18))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                Text(game.rules.scoring.label)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
            }
            Spacer()
            Menu {
                if let last = game.activeLog.last, !game.isFinished {
                    let name = game.players.first { $0.id == last.playerId }?.name ?? ""
                    Button("Ongedaan maken: \(name) \(last.delta.signedString)", systemImage: "arrow.uturn.backward") {
                        store.undo(entryId: last.id, in: game.id)
                    }
                }
                if !game.isFinished {
                    Button("Spel beëindigen", systemImage: "flag.checkered") { confirmFinish = true }
                }
                Button("Verwijderen", systemImage: "trash", role: .destructive) {
                    store.delete(game.id)
                    dismiss()
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 40)
            }
            .accessibilityLabel("Meer")
        }
        .foregroundStyle(Theme.text)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
    }

    private func controlCard(_ game: Game, selected: Player) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 8) {
                Text("Punten voor")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                HStack(spacing: 6) {
                    PlayerAvatar(selected, size: 22)
                    Text(selected.name)
                        .font(Theme.display(14))
                        .foregroundStyle(Theme.text)
                }
                .padding(.leading, 4)
                .padding(.trailing, 10)
                .padding(.vertical, 3)
                .background(Theme.surface2, in: .capsule)
            }
            .padding(.leading, 4)

            HStack(spacing: 12) {
                StepButton(symbol: "minus", foreground: Theme.negative, background: Theme.surface2) {
                    apply(-1, game: game, player: selected)
                }
                .accessibilityLabel("Aftrekken")
                VStack(spacing: 0) {
                    TextField("0", value: $amount, format: .number.grouping(.never))
                        .keyboardType(.numberPad)
                        .focused($amountFocused)
                        .multilineTextAlignment(.center)
                        .font(Theme.display(44, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.text)
                    Text("AANTAL PUNTEN")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(Theme.muted)
                }
                .frame(maxWidth: .infinity)
                StepButton(symbol: "plus", foreground: Theme.accentText, background: Theme.accent) {
                    apply(1, game: game, player: selected)
                }
                .accessibilityLabel("Optellen")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .card()
    }

    private func winnerCard(_ game: Game) -> some View {
        VStack(spacing: 8) {
            Text("WINNAAR")
                .font(Theme.display(13))
                .tracking(1.5)
                .foregroundStyle(Theme.accent)
            if let winner = game.winner {
                PlayerAvatar(winner, size: 72)
                Text(winner.name)
                    .font(Theme.display(26, weight: .bold))
                    .foregroundStyle(Theme.text)
                Text("\(game.score(of: winner.id)) punten")
                    .font(Theme.display(20))
                    .foregroundStyle(Theme.accent)
            }
            Button("Terug naar spellen") { dismiss() }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(18)
        .card()
    }

    // MARK: - Acties

    private func apply(_ sign: Int, game: Game, player: Player) {
        // 0 punten is toegestaan: zo telt de beurt mee voor de rondetelling.
        let delta = sign * max(0, amount ?? 0)
        let outcome = store.applyScore(delta, to: player.id, in: game.id)
        guard outcome != .ignored else { return }
        amount = 0
        // Door naar de volgende speler in invoervolgorde, zoals de PWA.
        if let i = game.players.firstIndex(where: { $0.id == player.id }) {
            selectedId = game.players[(i + 1) % game.players.count].id
        }
        if outcome == .finished { amountFocused = false }
    }
}

private struct StepButton: View {
    let symbol: String
    let foreground: Color
    let background: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(foreground)
                .frame(width: 64, height: 64)
                .background(background, in: .rect(cornerRadius: Theme.Radius.stepper))
        }
        .buttonStyle(.plain)
    }
}

private struct PlayerRow: View {
    let player: Player
    let score: Int
    let isSelected: Bool
    let isLeader: Bool
    let reachedMax: Bool

    var body: some View {
        HStack(spacing: 12) {
            PlayerAvatar(player, size: 44)
                .overlay(alignment: .topTrailing) {
                    if isLeader {
                        Image(systemName: "trophy.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.white)
                            .frame(width: 20, height: 20)
                            .background(Theme.gold, in: .circle)
                            .overlay(Circle().strokeBorder(Theme.surface, lineWidth: 2))
                            .offset(x: 6, y: -6)
                    }
                }
            VStack(alignment: .leading, spacing: 1) {
                Text(player.name)
                    .font(Theme.display(18))
                    .foregroundStyle(Theme.text)
                if isSelected {
                    Text("geselecteerd")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color(hex: player.color))
                }
            }
            Spacer()
            Text("\(score)")
                .font(Theme.display(30, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(reachedMax ? Theme.gold : (isLeader ? Theme.accent : Theme.text))
                .contentTransition(.numericText(value: Double(score)))
                .animation(.snappy, value: score)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(.rect)
        .card(radius: Theme.Radius.row)
        .overlay {
            if isSelected {
                RoundedRectangle(cornerRadius: Theme.Radius.row)
                    .strokeBorder(Color(hex: player.color), lineWidth: 2)
            }
        }
        .shadow(color: isSelected ? Color(hex: player.color).opacity(0.2) : .clear, radius: 9, y: 4)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

extension Int {
    /// "+5", "−3", "0"
    var signedString: String { self > 0 ? "+\(self)" : self < 0 ? "−\(-self)" : "0" }
}

#Preview {
    let store = GameStore.preview
    return NavigationStack {
        ScoringView(gameId: store.games[0].id)
    }
    .environment(store)
}

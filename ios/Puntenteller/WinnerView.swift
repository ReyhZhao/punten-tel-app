import SwiftUI
import PuntentellerKit

/// Uitslag met confetti, podium en ranglijst (zie `screens/WinnerScreen.tsx`).
struct WinnerView: View {
    let game: Game
    /// Opent het nieuwe spel na "Opnieuw spelen".
    let onRematch: (UUID) -> Void

    @Environment(GameStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private var ranked: [Player] { game.ranked }

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            LinearGradient(colors: [Theme.accent.opacity(0.12), Theme.bg.opacity(0)], startPoint: .top, endPoint: .center)
                .ignoresSafeArea()
            ConfettiView().ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.text)
                            .frame(width: 40, height: 40)
                            .background(Theme.surface2, in: .circle)
                    }
                    .accessibilityLabel("Sluiten")
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)

                ScrollView {
                    VStack(spacing: 22) {
                        if let winner = ranked.first { hero(winner) }
                        podium
                        if ranked.count > 3 { rest }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .bottom) {
            BottomBar {
                Button {
                    if let next = store.rematch(game.id) { onRematch(next.id) }
                } label: {
                    Label("Opnieuw spelen", systemImage: "arrow.counterclockwise")
                }
                .buttonStyle(PrimaryButtonStyle())
                Button("Terug naar spellen") { dismiss() }
                    .buttonStyle(SoftButtonStyle(height: 48))
            }
        }
        .sensoryFeedback(.success, trigger: game.id)
    }

    private func hero(_ winner: Player) -> some View {
        VStack(spacing: 6) {
            Text("WINNAAR")
                .font(Theme.display(13))
                .tracking(1.5)
                .foregroundStyle(Theme.accent)
            PlayerAvatar(winner, size: 92)
                .overlay(Circle().strokeBorder(Theme.surface, lineWidth: 4))
                .shadow(color: Color(hex: winner.color).opacity(0.35), radius: 14, y: 6)
                .padding(.vertical, 6)
            Text(winner.name)
                .font(Theme.display(32, weight: .bold))
                .foregroundStyle(Theme.text)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(game.score(of: winner.id))")
                    .font(Theme.display(44, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.accent)
                Text("punten")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.muted)
            }
        }
        .padding(.top, 8)
    }

    /// Top 3 in volgorde 2-1-3.
    private var podium: some View {
        HStack(alignment: .bottom, spacing: 10) {
            ForEach([1, 0, 2], id: \.self) { rank in
                if let player = ranked[safe: rank] {
                    PodiumColumn(player: player, rank: rank, score: game.score(of: player.id))
                } else {
                    Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
                }
            }
        }
    }

    /// Plek 4 en verder.
    private var rest: some View {
        VStack(spacing: 0) {
            ForEach(Array(ranked.dropFirst(3).enumerated()), id: \.element.id) { i, player in
                HStack(spacing: 12) {
                    Text("\(i + 4)")
                        .font(Theme.display(15))
                        .foregroundStyle(Theme.muted)
                        .frame(width: 22)
                    PlayerAvatar(player, size: 30)
                    Text(player.name)
                        .font(Theme.display(16))
                        .foregroundStyle(Theme.text)
                    Spacer()
                    Text("\(game.score(of: player.id))")
                        .font(Theme.display(17, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.text)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                if i < ranked.count - 4 {
                    Divider().overlay(Theme.sep).padding(.leading, 48)
                }
            }
        }
        .card()
    }
}

private struct PodiumColumn: View {
    let player: Player
    let rank: Int
    let score: Int

    private static let heights: [CGFloat] = [120, 88, 68]
    private static let medals = [Theme.gold, Theme.silver, Theme.bronze]

    var body: some View {
        VStack(spacing: 6) {
            PlayerAvatar(player, size: rank == 0 ? 48 : 40)
            Text(player.name)
                .font(Theme.display(14))
                .foregroundStyle(Theme.text)
                .lineLimit(1)
            VStack(spacing: 4) {
                Text("\(rank + 1)")
                    .font(Theme.display(15, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(Self.medals[rank], in: .circle)
                Text("\(score)")
                    .font(Theme.display(16, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.text)
            }
            .padding(.top, 10)
            .frame(maxWidth: .infinity, minHeight: Self.heights[rank], alignment: .top)
            .background(Self.medals[rank].opacity(0.22), in: UnevenRoundedRectangle(topLeadingRadius: 14, topTrailingRadius: 14))
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Plek \(rank + 1): \(player.name), \(score) punten")
    }
}

/// Vallende confetti in de spelerkleuren. Uit bij "Beperk beweging".
struct ConfettiView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Piece {
        let x: Double, delay: Double, duration: Double, size: Double, spin: Double, drift: Double
        let color: Color
    }

    private let pieces: [Piece] = (0..<60).map { i in
        // Vaste pseudo-willekeur, zodat het beeld niet bij elke render verspringt.
        func r(_ n: Int) -> Double { Double((i * 9301 + n * 49297) % 233280) / 233280 }
        return Piece(
            x: r(1), delay: r(2) * 4, duration: 3 + r(3) * 3, size: 6 + r(4) * 6,
            spin: (r(5) - 0.5) * 6, drift: (r(6) - 0.5) * 60,
            color: Color(hex: PlayerColors.color(at: i))
        )
    }

    var body: some View {
        if !reduceMotion {
            TimelineView(.animation) { timeline in
                let t = timeline.date.timeIntervalSinceReferenceDate
                Canvas { context, size in
                    for p in pieces {
                        let progress = ((t + p.delay).truncatingRemainder(dividingBy: p.duration)) / p.duration
                        let y = -20 + progress * (size.height + 40)
                        let x = p.x * size.width + sin(progress * .pi * 2) * p.drift
                        var piece = context
                        piece.translateBy(x: x, y: y)
                        piece.rotate(by: .radians(progress * p.spin * .pi))
                        piece.fill(
                            Path(roundedRect: CGRect(x: -p.size / 2, y: -p.size / 4, width: p.size, height: p.size / 2), cornerRadius: 1),
                            with: .color(p.color)
                        )
                    }
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }
}

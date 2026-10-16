import SwiftUI
import PuntentellerKit

/// Ronde avatar met initialen in de spelerkleur (gelijk aan `ui/PlayerAvatar.tsx`).
struct PlayerAvatar: View {
    let name: String
    let color: String
    var size: CGFloat = 40

    init(name: String, color: String, size: CGFloat = 40) {
        self.name = name
        self.color = color
        self.size = size
    }

    init(_ player: Player, size: CGFloat = 40) {
        self.init(name: player.name, color: player.color, size: size)
    }

    private var initials: String {
        let s = name.split(whereSeparator: \.isWhitespace).prefix(2).compactMap(\.first).map(String.init).joined()
        return s.isEmpty ? "?" : s.uppercased()
    }

    var body: some View {
        Text(initials)
            .font(Theme.display(size * 0.4))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color(hex: color), in: .circle)
            .overlay(Circle().strokeBorder(.black.opacity(0.08), lineWidth: 1))
            .accessibilityHidden(true)
    }
}

/// Uppercase label boven een formulier-onderdeel.
struct SectionLabel: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 12, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(Theme.muted)
    }
}

/// Primaire knop (accent). Standaard groot (56 hoog, radius 16).
struct PrimaryButtonStyle: ButtonStyle {
    var height: CGFloat = 56
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.display(height >= 56 ? 18 : 15))
            .foregroundStyle(Theme.accentText)
            .frame(maxWidth: .infinity, minHeight: height)
            .background(
                isEnabled ? Theme.accent : Theme.faint,
                in: .rect(cornerRadius: height >= 56 ? Theme.Radius.buttonLg : Theme.Radius.buttonSm)
            )
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

/// Zachte knop (surface2), bv. "Terug naar spellen" of de timerknoppen.
struct SoftButtonStyle: ButtonStyle {
    /// Compact = alleen zo breed als de inhoud (bv. een icoonknop).
    var compact = false
    var height: CGFloat = 42

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.display(height >= 56 ? 18 : 15))
            .foregroundStyle(Theme.text)
            .padding(.horizontal, compact ? 12 : 0)
            .frame(maxWidth: compact ? nil : .infinity, minHeight: height)
            .background(Theme.surface2, in: .rect(cornerRadius: height >= 56 ? Theme.Radius.buttonLg : Theme.Radius.buttonSm))
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

/// Vaste onderbalk die uitloopt in de achtergrond.
struct BottomBar<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 8) { content }
            .padding(.horizontal, 20)
            .padding(.top, 24)
            .padding(.bottom, 8)
            .background(
                LinearGradient(colors: [Theme.bg.opacity(0), Theme.bg], startPoint: .top, endPoint: .init(x: 0.5, y: 0.35))
            )
    }
}

extension View {
    /// Kaart-stijl: wit vlak, rand, zachte schaduw.
    func card(radius: CGFloat = Theme.Radius.card) -> some View {
        // Schaduw alleen op de kaartvorm, niet op de inhoud.
        self
            .background {
                RoundedRectangle(cornerRadius: radius)
                    .fill(Theme.surface)
                    .shadow(color: Theme.text.opacity(0.07), radius: 12, y: 8)
            }
            .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(Theme.border))
    }
}

extension Scoring {
    var label: String { self == .high ? "Hoogste wint" : "Laagste wint" }
    var symbol: String { self == .high ? "arrow.up" : "arrow.down" }
}

extension Date {
    /// "zojuist", "5 minuten geleden", "gisteren", …
    var relativeNL: String {
        if Date.now.timeIntervalSince(self) < 45 { return "zojuist" }
        return formatted(.relative(presentation: .named, unitsStyle: .wide).locale(Locale(identifier: "nl_NL")))
    }
}

extension GameRules {
    /// Korte samenvatting, zoals de badges in de PWA ("Hoogste wint", "60s timer", …).
    var badges: [String] {
        var b = [scoring.label]
        if timerOn { b.append("\(timerSecs)s timer") }
        if let maxScore { b.append("Max \(maxScore)") }
        if let maxRounds { b.append("\(maxRounds) rondes") }
        return b
    }
}

/// Kleine badges in een rij (spelregels van een profiel).
struct BadgeRow: View {
    let badges: [String]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(badges, id: \.self) { badge in
                Text(badge)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Theme.surface2, in: .capsule)
            }
        }
    }
}

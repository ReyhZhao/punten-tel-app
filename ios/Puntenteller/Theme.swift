import SwiftUI

/// "Confetti"-thema, gelijk aan frontend/src/theme.ts en docs/design-handoff.md.
enum Theme {
    static let bg = Color(hex: "#FAF6EE")
    static let surface = Color(hex: "#FFFFFF")
    static let surface2 = Color(hex: "#F3ECDF")
    static let text = Color(hex: "#28231D")
    static let muted = Color(hex: "#9C9384")
    static let faint = Color(hex: "#C9C0B0")
    static let accent = Color(hex: "#FF5A3C")
    static let accentText = Color.white
    static let border = Color(hex: "#28231D").opacity(0.08)
    static let sep = Color(hex: "#28231D").opacity(0.07)

    static let positive = Color(hex: "#34C759")
    static let negative = Color(hex: "#FF453A")
    static let gold = Color(hex: "#F4B400")
    static let silver = Color(hex: "#C7CBD1")
    static let bronze = Color(hex: "#CD7F4D")

    enum Radius {
        static let card: CGFloat = 22
        static let row: CGFloat = 18
        static let buttonLg: CGFloat = 16
        static let buttonMd: CGFloat = 14
        static let buttonSm: CGFloat = 12
        static let stepper: CGFloat = 20
        static let sheet: CGFloat = 26
    }

    /// Display-font. TODO: Fredoka bundelen (zie docs/ios-port.md); tot dan het
    /// ronde systeemfont als benadering.
    static func display(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

extension Color {
    /// `#RRGGBB` → Color. Ongeldige invoer wordt zwart.
    init(hex: String) {
        let v = UInt64(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0
        self.init(
            red: Double((v >> 16) & 0xFF) / 255,
            green: Double((v >> 8) & 0xFF) / 255,
            blue: Double(v & 0xFF) / 255
        )
    }
}

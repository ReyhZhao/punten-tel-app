import Foundation

/// Uitnodigcode (CONTEXT.md): 6 cijfers die een speler in Account toont, ook
/// als QR-code. De QR-code bevat een link met de code erin; zelfde formaat als
/// in de web-app (frontend/src/inviteCode.ts).
public enum InviteCode {
    /// "482913" → "482 913".
    public static func formatted(_ code: String) -> String {
        "\(code.prefix(3)) \(code.dropFirst(3))"
    }

    public static func qrPayload(_ code: String) -> String {
        "https://punten.vels.online/?uitnodigcode=\(code)"
    }

    /// Code uit getypte tekst of een gescande QR-code; `nil` als het geen code is.
    public static func parse(_ text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URLComponents(string: trimmed), url.scheme != nil,
           let value = url.queryItems?.first(where: { $0.name == "uitnodigcode" })?.value,
           isCode(value) {
            return value
        }
        let digits = trimmed.filter { !$0.isWhitespace }
        return isCode(digits) ? digits : nil
    }

    private static func isCode(_ s: String) -> Bool {
        s.count == 6 && s.allSatisfy { $0.isASCII && $0.isNumber }
    }
}

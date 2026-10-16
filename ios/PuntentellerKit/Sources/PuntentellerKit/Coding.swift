import Foundation

// JSON-formaat voor opslag op het toestel en (straks) voor de sync-API:
// ISO-8601-tijden met milliseconden, in UTC (ADR-0002).

private let isoWithFraction = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
private let isoPlain = Date.ISO8601FormatStyle()

extension JSONEncoder {
    public static var puntenteller: JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .custom { date, encoder in
            var c = encoder.singleValueContainer()
            try c.encode(date.formatted(isoWithFraction))
        }
        e.outputFormatting = [.sortedKeys]
        return e
    }
}

extension JSONDecoder {
    public static var puntenteller: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let c = try decoder.singleValueContainer()
            let s = try c.decode(String.self)
            if let date = try? isoWithFraction.parse(s) { return date }
            if let date = try? isoPlain.parse(s) { return date }
            throw DecodingError.dataCorruptedError(in: c, debugDescription: "Ongeldige ISO-8601-datum: \(s)")
        }
        return d
    }
}

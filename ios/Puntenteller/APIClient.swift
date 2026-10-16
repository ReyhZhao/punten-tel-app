import Foundation
import PuntentellerKit

/// Account zoals de backend het teruggeeft.
struct Account: Codable, Equatable, Sendable {
    var id: String
    var email: String
    var displayName: String
}

/// Fout van de backend (`{code, detail}`) of van het netwerk. `message` is Nederlands.
struct APIError: Error, LocalizedError, Equatable {
    var code: String
    var message: String
    var status: Int?

    var errorDescription: String? { message }

    static let offline = APIError(code: "offline", message: "Geen verbinding met de server. Probeer het later opnieuw.")
    static let unauthorized = APIError(code: "unauthorized", message: "Je bent uitgelogd. Log opnieuw in.", status: 401)
}

/// Dunne client voor de Puntenteller-API (backend/README.md).
struct APIClient: Sendable {
    let baseURL: URL
    var token: String?

    /// Productie, tenzij `PUNTENTELLER_API_URL` gezet is (bv. lokaal: http://127.0.0.1:8000/api/v1).
    static var defaultBaseURL: URL {
        if let override = ProcessInfo.processInfo.environment["PUNTENTELLER_API_URL"], let url = URL(string: override) {
            return url
        }
        let configured = Bundle.main.object(forInfoDictionaryKey: "PuntentellerAPIBaseURL") as? String
        return URL(string: configured ?? "https://punten.vels.online/api/v1")!
    }

    struct RequestCodeResult: Decodable { var sent: Bool; var newAccount: Bool }
    struct VerifyResult: Decodable { var token: String; var account: Account }
    struct LookupResult: Decodable { var id: String; var displayName: String }

    func requestCode(email: String, displayName: String?) async throws -> RequestCodeResult {
        var body = ["email": email]
        if let displayName { body["displayName"] = displayName }
        return try await send("POST", "auth/request-code", body: body)
    }

    func verify(email: String, code: String, deviceName: String) async throws -> VerifyResult {
        try await send("POST", "auth/verify", body: ["email": email, "code": code, "deviceName": deviceName])
    }

    func logout() async throws {
        let _: Empty = try await send("POST", "auth/logout")
    }

    func me() async throws -> Account { try await send("GET", "me") }

    func updateDisplayName(_ name: String) async throws -> Account {
        try await send("PATCH", "me", body: ["displayName": name])
    }

    func deleteAccount() async throws {
        let _: Empty = try await send("DELETE", "me")
    }

    func lookup(email: String) async throws -> LookupResult {
        try await send("POST", "accounts/lookup", body: ["email": email])
    }

    func sync(_ request: SyncRequest) async throws -> SyncResponse {
        try await send("POST", "sync", body: request)
    }

    func leave(gameId: UUID) async throws {
        let _: Empty = try await send("POST", "games/\(gameId.uuidString.lowercased())/leave")
    }

    // MARK: - Transport

    private struct Empty: Decodable {}
    private struct ErrorBody: Decodable { var code: String?; var detail: String? }

    private func send<T: Decodable>(_ method: String, _ path: String) async throws -> T {
        try await send(method, path, body: Optional<String>.none)
    }

    private func send<T: Decodable, B: Encodable>(_ method: String, _ path: String, body: B?) async throws -> T {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder.puntenteller.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.offline
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            if status == 401 { throw APIError.unauthorized }
            let body = try? JSONDecoder().decode(ErrorBody.self, from: data)
            throw APIError(
                code: body?.code ?? "http_\(status)",
                message: body?.detail ?? Self.fallbackMessage(status: status, data: data),
                status: status
            )
        }
        if T.self == Empty.self { return Empty() as! T }
        do {
            return try JSONDecoder.puntenteller.decode(T.self, from: data)
        } catch {
            throw APIError(code: "decode", message: "Onverwacht antwoord van de server.", status: status)
        }
    }

    /// DRF-validatiefouten zijn `{veld: [melding]}`; pak de eerste melding.
    private static func fallbackMessage(status: Int, data: Data) -> String {
        if let fields = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let first = fields.values.first,
           let message = (first as? [String])?.first ?? first as? String {
            return message
        }
        if status == 429 { return "Te veel verzoeken. Probeer het later opnieuw." }
        return "Er ging iets mis (\(status)). Probeer het later opnieuw."
    }
}

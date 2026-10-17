import Foundation
import Observation
import os
import PuntentellerKit
import UIKit

/// Account en sync met de backend (ADR-0003). Zonder account doet dit niets:
/// de app werkt dan volledig lokaal.
///
/// Wanneer er gesynct wordt:
/// - direct na het inloggen (alle lokale spellen gaan mee);
/// - realtime: zodra de server via de SSE-stream (`/events`) meldt dat er iets
///   veranderd is (docs/research/sse-realtime-updates.md);
/// - als de app actief wordt, en daarna als vangnet elke 60 s (stream open)
///   of 20 s (stream weg) zolang hij actief is;
/// - 2 seconden na een lokale wijziging (zodat snel tikken één sync wordt);
/// - bij pull-to-refresh.
@MainActor @Observable
final class SyncEngine {
    enum Status: Equatable {
        case idle
        case syncing
        case failed(String)
    }

    private(set) var account: Account?
    private(set) var status: Status = .idle
    private(set) var lastSyncAt: Date?
    /// De realtime-stream is open.
    private(set) var isLive = false

    @ObservationIgnored private let store: GameStore
    /// Na een geslaagde login (PushManager vraagt dan om toestemming voor meldingen).
    @ObservationIgnored var onSignedIn: (() -> Void)?
    @ObservationIgnored private var token: String?
    @ObservationIgnored private var inFlight = false
    @ObservationIgnored private var runAgain = false
    @ObservationIgnored private var debounce: Task<Void, Never>?
    @ObservationIgnored private var poller: Task<Void, Never>?
    @ObservationIgnored private var events: Task<Void, Never>?
    @ObservationIgnored private var active = false
    @ObservationIgnored private let log = Logger(subsystem: "online.vels.puntenteller", category: "Sync")

    private static let accountKey = "account"
    private static let tokenKey = "api-token"

    init(store: GameStore) {
        self.store = store
        token = Keychain.read(Self.tokenKey)
        if token != nil, let data = UserDefaults.standard.data(forKey: Self.accountKey) {
            account = try? JSONDecoder().decode(Account.self, from: data)
        }
        store.onLocalChange = { [weak self] in self?.scheduleSync() }
    }

    var isSignedIn: Bool { account != nil && token != nil }
    /// Account-id in kleine letters, zoals de backend het teruggeeft.
    var accountId: String? { account?.id.lowercased() }

    private var api: APIClient { APIClient(baseURL: APIClient.defaultBaseURL, token: token) }

    // MARK: - Account

    func requestCode(email: String, displayName: String?) async throws -> APIClient.RequestCodeResult {
        try await api.requestCode(email: email, displayName: displayName)
    }

    func verify(email: String, code: String) async throws {
        let result = try await api.verify(email: email, code: code, deviceName: UIDevice.current.name)
        token = result.token
        Keychain.write(result.token, for: Self.tokenKey)
        setAccount(result.account)
        store.prepareFirstSync()
        restartEventStream()
        onSignedIn?()
        await syncNow()
    }

    func updateDisplayName(_ name: String) async throws {
        setAccount(try await api.updateDisplayName(name))
    }

    func signOut() async {
        try? await api.logout()
        clearSession()
    }

    func deleteAccount() async throws {
        try await api.deleteAccount()
        clearSession()
    }

    // MARK: - Uitnodigen en gedeelde spellen

    func lookup(email: String) async throws -> APIClient.LookupResult {
        try await api.lookup(email: email)
    }

    /// Eigenaar overdragen. Eerst syncen, zodat net uitgenodigde spelers ook op
    /// de server gekoppeld zijn; daarna syncen voor de nieuwe eigenaar.
    func transfer(_ gameId: UUID, to accountId: String, ownerPlayerId: UUID?) async throws {
        await syncNow()
        try await api.transfer(gameId: gameId, to: accountId, ownerPlayerId: ownerPlayerId)
        await syncNow()
    }

    func registerPushDevice(token: String, environment: String) async throws {
        try await api.registerPushDevice(token: token, environment: environment)
    }

    func leave(_ gameId: UUID) async throws {
        try await api.leave(gameId: gameId)
        store.removeLocally(gameId)
    }

    // MARK: - Sync

    /// App actief of niet: stream en periodiek syncen alleen op de voorgrond
    /// (iOS breekt verbindingen in de achtergrond toch af).
    func setActive(_ active: Bool) {
        self.active = active
        poller?.cancel()
        events?.cancel()
        isLive = false
        guard active else { return }
        poller = Task { [weak self] in
            while !Task.isCancelled {
                await self?.syncNow()
                let interval = (self?.isLive ?? false) ? 60 : 20
                try? await Task.sleep(for: .seconds(interval))
            }
        }
        events = Task { [weak self] in await self?.runEventStream() }
    }

    /// Na in- of uitloggen: stream opnieuw openen met het nieuwe token (of sluiten).
    private func restartEventStream() {
        events?.cancel()
        isLive = false
        guard active, isSignedIn else { return }
        events = Task { [weak self] in await self?.runEventStream() }
    }

    func scheduleSync(after delay: Duration = .seconds(2)) {
        guard isSignedIn else { return }
        debounce?.cancel()
        debounce = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await self?.syncNow()
        }
    }

    /// Leest de SSE-stream en synct bij elk seintje met een nieuwere cursor.
    /// Verbreekt de verbinding, dan opnieuw verbinden met oplopende pauze.
    private func runEventStream() async {
        var backoff = 2.0
        while !Task.isCancelled {
            guard isSignedIn else {
                try? await Task.sleep(for: .seconds(5))
                continue
            }
            do {
                let (bytes, response) = try await URLSession.shared.bytes(for: api.eventsRequest())
                guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw APIError.offline }
                isLive = true
                backoff = 2
                var event = ""
                for try await line in bytes.lines {
                    if line.hasPrefix("event:") {
                        event = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
                    } else if line.hasPrefix("data:"), event == "change" {
                        let cursor = Int(line.dropFirst(5).trimmingCharacters(in: .whitespaces)) ?? .max
                        if cursor > (store.syncCursor ?? -1) {
                            // Kleine willekeurige vertraging: toestellen achter hetzelfde
                            // IP (wifi aan tafel) syncen dan niet allemaal tegelijk.
                            scheduleSync(after: .milliseconds(Int.random(in: 200...1500)))
                        }
                        event = ""
                    }
                }
            } catch {
                if Task.isCancelled { break }
            }
            isLive = false
            try? await Task.sleep(for: .seconds(backoff))
            backoff = min(backoff * 2, 30)
        }
        isLive = false
    }

    func syncNow() async {
        guard isSignedIn else { return }
        if inFlight {
            runAgain = true
            return
        }
        inFlight = true
        status = .syncing
        defer { inFlight = false }

        repeat {
            runAgain = false
            let (request, snapshot) = store.syncRequest(me: accountId)
            do {
                let response = try await api.sync(request)
                store.applySync(response, sent: snapshot)
                if !response.rejected.isEmpty {
                    log.warning("Sync: \(response.rejected.count) wijziging(en) geweigerd")
                }
                lastSyncAt = .now
                status = .idle
            } catch let error as APIError where error == .unauthorized {
                clearSession()
                status = .failed(error.message)
                return
            } catch {
                status = .failed(error.localizedDescription)
                return
            }
        } while runAgain
    }

    // MARK: - Opslag

    private func setAccount(_ account: Account?) {
        self.account = account
        if let account, let data = try? JSONEncoder().encode(account) {
            UserDefaults.standard.set(data, forKey: Self.accountKey)
        } else {
            UserDefaults.standard.removeObject(forKey: Self.accountKey)
        }
    }

    /// Uitloggen: token en account weg, sync-status gewist. De spellen blijven lokaal.
    private func clearSession() {
        token = nil
        Keychain.write(nil, for: Self.tokenKey)
        setAccount(nil)
        store.resetSync()
        restartEventStream()
        lastSyncAt = nil
        if case .failed = status {} else { status = .idle }
    }
}

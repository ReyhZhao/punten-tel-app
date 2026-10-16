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
/// - als de app actief wordt, en daarna elke 20 seconden zolang hij actief is;
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

    @ObservationIgnored private let store: GameStore
    @ObservationIgnored private var token: String?
    @ObservationIgnored private var inFlight = false
    @ObservationIgnored private var runAgain = false
    @ObservationIgnored private var debounce: Task<Void, Never>?
    @ObservationIgnored private var poller: Task<Void, Never>?
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

    func leave(_ gameId: UUID) async throws {
        try await api.leave(gameId: gameId)
        store.removeLocally(gameId)
    }

    // MARK: - Sync

    /// App actief of niet: periodiek syncen alleen op de voorgrond.
    func setActive(_ active: Bool) {
        poller?.cancel()
        guard active else { return }
        poller = Task { [weak self] in
            while !Task.isCancelled {
                await self?.syncNow()
                try? await Task.sleep(for: .seconds(20))
            }
        }
    }

    func scheduleSync() {
        guard isSignedIn else { return }
        debounce?.cancel()
        debounce = Task { [weak self] in
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            await self?.syncNow()
        }
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
        lastSyncAt = nil
        if case .failed = status {} else { status = .idle }
    }
}

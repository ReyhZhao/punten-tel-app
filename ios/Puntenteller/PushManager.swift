import Foundation
import Observation
import os
import UIKit
import UserNotifications

/// Pushmeldingen (ADR-0003): toestemming vragen, het toestel-token bij de
/// backend registreren en een tik op een melding doorgeven (spel openen).
/// Werkt alleen met een account; de backend bepaalt wanneer er iets gestuurd
/// wordt (uitgenodigd, spel afgelopen, spel overgedragen).
@MainActor @Observable
final class PushManager {
    private(set) var status: UNAuthorizationStatus = .notDetermined
    /// Spel dat geopend moet worden na een tik op een melding.
    var gameToOpen: UUID?

    @ObservationIgnored private let sync: SyncEngine
    @ObservationIgnored private var deviceToken: String?
    @ObservationIgnored private let log = Logger(subsystem: "online.vels.puntenteller", category: "Push")

    /// Debug-builds praten met de sandbox van Apple, TestFlight/App Store met productie.
    private static var environment: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }

    init(sync: SyncEngine) {
        self.sync = sync
        sync.onSignedIn = { [weak self] in
            Task { await self?.requestAuthorization() }
        }
    }

    /// Bij het starten: status bijwerken en (als dat mag) opnieuw registreren;
    /// het token kan door iOS gewijzigd zijn.
    func refresh() async {
        status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        log.info("Meldingen-status: \(self.status.rawValue, privacy: .public)")
        if status == .authorized || status == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    /// Vraagt toestemming (eenmalig systeemvenster) en registreert daarna.
    func requestAuthorization() async {
        do {
            _ = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            log.error("Toestemming voor meldingen mislukt: \(error.localizedDescription)")
        }
        await refresh()
    }

    func didRegister(deviceToken data: Data) {
        let token = data.map { String(format: "%02x", $0) }.joined()
        log.info("Toestel-token ontvangen (\(token.count, privacy: .public) tekens)")
        deviceToken = token
        Task { await upload() }
    }

    /// Na inloggen of een nieuw token: toestel bij de backend aanmelden.
    func upload() async {
        guard let deviceToken, sync.isSignedIn else { return }
        do {
            try await sync.registerPushDevice(token: deviceToken, environment: Self.environment)
        } catch {
            log.warning("Toestel registreren voor push mislukt: \(error.localizedDescription)")
        }
    }

    func openSettings() {
        if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

/// Ontvangt het toestel-token en meldingen van iOS. Op de main actor: UIKit
/// verwacht dat de afhandeling van een tik op de main thread wordt afgerond
/// (een `nonisolated async`-variant crasht daar).
@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    var push: PushManager?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        push?.didRegister(deviceToken: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Logger(subsystem: "online.vels.puntenteller", category: "Push")
            .warning("Registreren voor push mislukt: \(error.localizedDescription)")
    }

    /// Melding terwijl de app open is: gewoon tonen (de stand is al realtime bijgewerkt).
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter, willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }

    /// Tik op een melding: het spel openen. Alleen het id (een String) gaat naar
    /// de main thread; daar wordt ook afgerond, zoals UIKit verwacht.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let gameId = response.notification.request.content.userInfo["gameId"] as? String
        nonisolated(unsafe) let done = completionHandler
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                if let id = gameId.flatMap(UUID.init) { self.push?.gameToOpen = id }
                done()
            }
        }
    }
}

import SwiftUI

@main
struct PuntentellerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var store: GameStore
    @State private var sync: SyncEngine
    @State private var push: PushManager
    @AppStorage(Preferences.keepAwake) private var keepAwake = false
    @Environment(\.scenePhase) private var scenePhase

    init() {
        let store = GameStore()
        let sync = SyncEngine(store: store)
        _store = State(initialValue: store)
        _sync = State(initialValue: sync)
        _push = State(initialValue: PushManager(sync: sync))
    }

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(store)
                .environment(sync)
                .environment(push)
                .task {
                    appDelegate.push = push
                    if sync.isSignedIn { await push.refresh() }
                }
                .tint(Theme.accent)
                // "Scherm aan houden" (de wake lock van de PWA).
                .onAppear { UIApplication.shared.isIdleTimerDisabled = keepAwake }
                .onChange(of: keepAwake) { _, on in UIApplication.shared.isIdleTimerDisabled = on }
                // Syncen zolang de app op de voorgrond staat (alleen met een account).
                .onChange(of: scenePhase, initial: true) { _, phase in sync.setActive(phase == .active) }
        }
    }
}

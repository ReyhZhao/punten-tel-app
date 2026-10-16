import SwiftUI

@main
struct PuntentellerApp: App {
    @State private var store: GameStore
    @State private var sync: SyncEngine
    @AppStorage(Preferences.keepAwake) private var keepAwake = false
    @Environment(\.scenePhase) private var scenePhase

    init() {
        let store = GameStore()
        _store = State(initialValue: store)
        _sync = State(initialValue: SyncEngine(store: store))
    }

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(store)
                .environment(sync)
                .tint(Theme.accent)
                // "Scherm aan houden" (de wake lock van de PWA).
                .onAppear { UIApplication.shared.isIdleTimerDisabled = keepAwake }
                .onChange(of: keepAwake) { _, on in UIApplication.shared.isIdleTimerDisabled = on }
                // Syncen zolang de app op de voorgrond staat (alleen met een account).
                .onChange(of: scenePhase, initial: true) { _, phase in sync.setActive(phase == .active) }
        }
    }
}

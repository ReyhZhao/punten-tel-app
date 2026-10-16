import SwiftUI

@main
struct PuntentellerApp: App {
    @State private var store = GameStore()
    @AppStorage(Preferences.keepAwake) private var keepAwake = false

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(store)
                .tint(Theme.accent)
                // "Scherm aan houden" (de wake lock van de PWA).
                .onAppear { UIApplication.shared.isIdleTimerDisabled = keepAwake }
                .onChange(of: keepAwake) { _, on in UIApplication.shared.isIdleTimerDisabled = on }
        }
    }
}

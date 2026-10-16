import SwiftUI

@main
struct PuntentellerApp: App {
    @State private var store = GameStore()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(store)
                .tint(Theme.accent)
        }
    }
}

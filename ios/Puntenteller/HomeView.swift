import SwiftUI
import PuntentellerKit

/// Startscherm "Spellen". Voorlopig alleen de lege staat; de lijst met spellen
/// en "Nieuw spel" komen met de port (docs/ios-port.md).
struct HomeView: View {
    var games: [Game] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                Text("PUNTENTELLER")
                    .font(Theme.display(13))
                    .tracking(1.5)
                    .foregroundStyle(Theme.accent)
                Text("Spellen")
                    .font(Theme.display(38, weight: .bold))
                    .foregroundStyle(Theme.text)
            }
            .padding(22)

            Spacer()
            if games.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "die.face.5")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.muted)
                        .frame(width: 96, height: 96)
                        .background(Theme.surface2, in: .rect(cornerRadius: 30))
                    Text("Nog geen spellen")
                        .font(Theme.display(20))
                        .foregroundStyle(Theme.text)
                    Text("Start een nieuw spel om punten bij te houden.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                }
                .frame(maxWidth: .infinity)
            }
            Spacer()
        }
        .background(Theme.bg)
    }
}

#Preview {
    HomeView()
}

import SwiftUI
import PuntentellerKit

/// Startscherm "Spellen": alle spellen, laatst gespeeld eerst, en "Nieuw spel".
struct HomeView: View {
    @Environment(GameStore.self) private var store
    @State private var path: [UUID] = []
    @State private var showNewGame = false
    @State private var showImport = false
    @State private var importResult: ImportResult?

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    if store.games.isEmpty {
                        emptyState
                    } else {
                        ForEach(store.games) { game in
                            NavigationLink(value: game.id) { GameCard(game: game) }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button("Verwijderen", systemImage: "trash", role: .destructive) {
                                        store.delete(game.id)
                                    }
                                }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 100)
            }
            .background(Theme.bg)
            .safeAreaInset(edge: .bottom) {
                BottomBar {
                    Button { showNewGame = true } label: {
                        Label("Nieuw spel", systemImage: "plus")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: UUID.self) { id in
                ScoringView(gameId: id)
            }
            .sheet(isPresented: $showImport, onDismiss: { importResult = nil }) {
                ImportView(result: importResult)
            }
            // Bestand uit het deelmenu ("Open in Puntenteller"), bv. vanuit de web-app.
            .onOpenURL { url in
                guard url.isFileURL else { return }
                importResult = ImportView.runImport(url, store: store)
                showNewGame = false
                showImport = true
                // iOS levert een kopie in Documents/Inbox; alleen die ruimen we op.
                if url.deletingLastPathComponent().lastPathComponent == "Inbox" {
                    try? FileManager.default.removeItem(at: url)
                }
            }
            .fullScreenCover(isPresented: $showNewGame) {
                NewGameView { game in
                    showNewGame = false
                    path.append(game.id)
                }
            }
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text("PUNTENTELLER")
                    .font(Theme.display(13))
                    .tracking(1.5)
                    .foregroundStyle(Theme.accent)
                Text("Spellen")
                    .font(Theme.display(38, weight: .bold))
                    .foregroundStyle(Theme.text)
            }
            Spacer()
            Menu {
                Button("Importeren uit web-app", systemImage: "square.and.arrow.down") { showImport = true }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .frame(width: 52, height: 52)
                    .background(Theme.surface2, in: .rect(cornerRadius: 16))
            }
            .accessibilityLabel("Meer")
            Image(systemName: "die.face.5")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(Theme.accentText)
                .frame(width: 52, height: 52)
                .background(Theme.accent, in: .rect(cornerRadius: 16))
        }
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    private var emptyState: some View {
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
                .multilineTextAlignment(.center)
            Button { showImport = true } label: {
                Label("Spellen overzetten uit de web-app", systemImage: "square.and.arrow.down")
                    .font(.system(size: 15, weight: .semibold))
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 120)
    }
}

/// Kaart voor één spel op het startscherm.
private struct GameCard: View {
    let game: Game

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(game.name)
                            .font(Theme.display(20))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                        if game.isFinished {
                            Text("KLAAR")
                                .font(.system(size: 10.5, weight: .bold))
                                .tracking(0.5)
                                .foregroundStyle(Theme.muted)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 2)
                                .background(Theme.surface2, in: .capsule)
                        }
                    }
                    HStack(spacing: 4) {
                        Image(systemName: game.rules.scoring.symbol)
                            .foregroundStyle(Theme.accent)
                        Text("\(game.rules.scoring.label) · \(game.lastPlayed.relativeNL)")
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(Theme.faint)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)

            HStack {
                HStack(spacing: -10) {
                    ForEach(game.players.prefix(6)) { p in
                        PlayerAvatar(p, size: 30)
                            .overlay(Circle().strokeBorder(Theme.surface2, lineWidth: 2))
                    }
                    if game.players.count > 6 {
                        Text("+\(game.players.count - 6)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Theme.muted)
                            .padding(.leading, 14)
                    }
                }
                Spacer()
                if let leader = game.winner ?? game.leaders.first {
                    HStack(spacing: 5) {
                        Image(systemName: "trophy.fill").foregroundStyle(Theme.gold)
                        Text(leader.name).foregroundStyle(Theme.text)
                        Text("\(game.score(of: leader.id))")
                            .font(Theme.display(15))
                            .foregroundStyle(Theme.accent)
                            .monospacedDigit()
                    }
                    .font(.system(size: 14, weight: .semibold))
                } else {
                    Text("\(game.players.count) spelers")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(Theme.surface2)
        }
        .clipShape(.rect(cornerRadius: Theme.Radius.card))
        .card()
    }
}

#Preview("Met spellen") {
    HomeView().environment(GameStore.preview)
}

#Preview("Leeg") {
    HomeView().environment(GameStore(fileURL: nil))
}

import SwiftUI
import PuntentellerKit

/// Kernscherm: punten op- en aftellen per speler (zie `screens/ScoringScreen.tsx`).
/// Een afgerond spel toont het winnaarscherm.
struct ScoringView: View {
    let gameId: UUID
    /// Na "Opnieuw spelen": het nieuwe spel openen in plaats van dit spel.
    var onRematch: (UUID) -> Void = { _ in }

    @Environment(GameStore.self) private var store

    var body: some View {
        if let game = store.game(gameId) {
            if game.isFinished {
                WinnerView(game: game, onRematch: onRematch)
            } else {
                ScoringContent(game: game)
            }
        } else {
            ContentUnavailableView("Spel niet gevonden", systemImage: "questionmark.circle")
        }
    }
}

/// Zwevende +N/−N bij een boeking.
private struct FloatEntry: Identifiable, Equatable {
    let id = UUID()
    let playerId: UUID
    let delta: Int
}

private struct ScoringContent: View {
    let game: Game

    @Environment(GameStore.self) private var store
    @Environment(SyncEngine.self) private var sync
    @Environment(\.dismiss) private var dismiss
    @State private var amount: Int? = 1
    @State private var confirmLeave = false
    @State private var showSharing = false
    @State private var leaveError: String?
    @State private var selectedId: UUID?
    @State private var floats: [FloatEntry] = []
    @State private var showHistory = false
    @State private var confirmReset = false
    @State private var confirmDelete = false
    @FocusState private var amountFocused: Bool

    // Timer per beurt (lokale UI-state, niet opgeslagen; zoals de PWA).
    @State private var turnIdx = 0
    @State private var remaining = 60
    @State private var running = false

    private var isOwner: Bool { game.isOwned(by: sync.accountId) }
    private var canScore: Bool { game.canScore(as: sync.accountId) }

    private var selected: Player? {
        game.players.first { $0.id == selectedId } ?? game.players.first
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 10) {
                    if !canScore { viewOnlyCard }
                    if canScore, let selected { controlCard(selected: selected) }
                    if let left = game.endTurnsLeft { finishingBanner(turnsLeft: left) }
                    if canScore, game.rules.timerOn, let turnPlayer = game.players[safe: turnIdx] ?? game.players.first {
                        TurnTimerView(
                            player: turnPlayer,
                            remaining: remaining,
                            total: game.rules.timerSecs,
                            running: running,
                            onReset: { remaining = game.rules.timerSecs },
                            onToggle: { running.toggle() },
                            onNext: nextTurn
                        )
                    }
                    ForEach(game.displayOrder) { player in
                        let score = game.score(of: player.id)
                        PlayerRow(
                            player: player,
                            score: score,
                            isSelected: canScore && player.id == selected?.id,
                            isLeader: game.leaders.contains { $0.id == player.id },
                            isMaxed: game.endTurnsLeft != nil && game.rules.maxScore.map { score >= $0 } == true,
                            floats: floats.filter { $0.playerId == player.id }
                        )
                        .onTapGesture { if canScore { selectedId = player.id } }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
                .animation(.snappy, value: game.displayOrder.map(\.id))
                .animation(.snappy, value: game.endTurnsLeft)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Theme.bg)
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.impact(weight: .light), trigger: game.activeLog.count)
        .onAppear { remaining = game.rules.timerSecs }
        .task(id: running) {
            // Tikt elke seconde zolang de timer loopt; stopt vanzelf bij pauze.
            while running, game.rules.timerOn {
                try? await Task.sleep(for: .seconds(1))
                guard running, !Task.isCancelled else { return }
                remaining = max(0, remaining - 1)
                if remaining == 0 { running = false }
            }
        }
        .sheet(isPresented: $showHistory) {
            HistoryView(game: game, canUndo: canScore) { store.undo(entryId: $0, in: game.id) }
                .presentationDetents([.medium, .large])
                .presentationCornerRadius(Theme.Radius.sheet)
        }
        .confirmationDialog("Scores resetten?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Resetten", role: .destructive) { store.resetScores(game.id) }
        } message: {
            Text("Alle standen gaan terug naar 0.")
        }
        .sheet(isPresented: $showSharing) { SharingView(gameId: game.id) }
        .confirmationDialog("Spel verlaten?", isPresented: $confirmLeave, titleVisibility: .visible) {
            Button("Verlaten", role: .destructive) {
                Task {
                    do {
                        try await sync.leave(game.id)
                        dismiss()
                    } catch {
                        leaveError = error.localizedDescription
                    }
                }
            }
        } message: {
            Text("Je ziet dit spel dan niet meer. De eigenaar kan je opnieuw uitnodigen.")
        }
        .alert("Verlaten mislukt", isPresented: Binding(get: { leaveError != nil }, set: { if !$0 { leaveError = nil } })) {
            Button("OK") {}
        } message: {
            Text(leaveError ?? "")
        }
        .confirmationDialog("Spel verwijderen?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Verwijderen", role: .destructive) {
                store.delete(game.id)
                dismiss()
            }
        }
    }

    // MARK: - Onderdelen

    private var header: some View {
        HStack(spacing: 0) {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 40)
            }
            .accessibilityLabel("Terug")
            Spacer()
            VStack(spacing: 1) {
                Text(game.name)
                    .font(Theme.display(18))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
            }
            Spacer()
            Button { showHistory = true } label: {
                Image(systemName: "list.bullet")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 40)
            }
            .accessibilityLabel("Historie")
            Menu {
                if canScore {
                    Button("Beëindig spel & toon winnaar", systemImage: "flag.checkered") { store.finish(game.id) }
                }
                Button("Historie bekijken", systemImage: "list.bullet") { showHistory = true }
                if isOwner && sync.isSignedIn {
                    Button("Spelers en delen", systemImage: "person.2") { showSharing = true }
                }
                if isOwner {
                    Button("Scores resetten", systemImage: "arrow.counterclockwise") { confirmReset = true }
                    Button("Spel verwijderen", systemImage: "trash", role: .destructive) { confirmDelete = true }
                } else {
                    Button("Spel verlaten", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                        confirmLeave = true
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 40)
            }
            .accessibilityLabel("Meer")
        }
        .foregroundStyle(Theme.text)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
    }

    /// Gedeeld spel waarin je niet mag scoren: alleen meekijken.
    private var viewOnlyCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "eye")
                .font(.system(size: 17))
                .foregroundStyle(Theme.accent)
                .frame(width: 40, height: 40)
                .background(Theme.surface2, in: .rect(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 1) {
                Text("Alleen bekijken")
                    .font(Theme.display(16))
                    .foregroundStyle(Theme.text)
                Text("\(store.accountName(game.ownerId) ?? "De eigenaar") houdt de scores bij. De stand wordt vanzelf bijgewerkt.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .card()
    }

    private var subtitle: String {
        var s = game.rules.scoring.label
        if let round = game.currentRound, let max = game.rules.maxRounds { s += " · Ronde \(round)/\(max)" }
        return s
    }

    private func controlCard(selected: Player) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 8) {
                Text("Punten voor")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                HStack(spacing: 6) {
                    PlayerAvatar(selected, size: 22)
                    Text(selected.name)
                        .font(Theme.display(14))
                        .foregroundStyle(Theme.text)
                }
                .padding(.leading, 4)
                .padding(.trailing, 10)
                .padding(.vertical, 3)
                .background(Theme.surface2, in: .capsule)
            }
            .padding(.leading, 4)

            HStack(spacing: 12) {
                StepButton(symbol: "minus", foreground: Theme.negative, background: Theme.surface2) {
                    apply(-1, player: selected)
                }
                .accessibilityLabel("Aftrekken")
                VStack(spacing: 0) {
                    TextField("0", value: $amount, format: .number.grouping(.never))
                        .keyboardType(.numberPad)
                        .focused($amountFocused)
                        .multilineTextAlignment(.center)
                        .font(Theme.display(44, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.text)
                    Text("AANTAL PUNTEN")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(Theme.muted)
                }
                .frame(maxWidth: .infinity)
                StepButton(symbol: "plus", foreground: Theme.accentText, background: Theme.accent) {
                    apply(1, player: selected)
                }
                .accessibilityLabel("Optellen")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .card()
    }

    /// Max bereikt, maar de ronde / extra beurten worden nog afgemaakt.
    private func finishingBanner(turnsLeft: Int) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "flag.fill")
                .font(.system(size: 17))
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(Theme.gold, in: .rect(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 1) {
                Text("Maximum bereikt")
                    .font(Theme.display(16))
                    .foregroundStyle(Theme.text)
                Text(game.rules.endMode == .extraTurn ? "Iedereen krijgt nog één beurt" : "De ronde wordt nog afgemaakt")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.muted)
            }
            Spacer()
            VStack(spacing: 0) {
                Text("\(turnsLeft)")
                    .font(Theme.display(22, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.text)
                    .contentTransition(.numericText(value: Double(turnsLeft)))
                Text(turnsLeft == 1 ? "beurt" : "beurten")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.muted)
            }
            .frame(minWidth: 54, minHeight: 50)
            .background(Theme.surface, in: .rect(cornerRadius: 12))
        }
        .padding(12)
        .background(Color(hex: "#FFF7E0"), in: .rect(cornerRadius: Theme.Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card).strokeBorder(Theme.gold.opacity(0.4)))
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    // MARK: - Acties

    private func apply(_ sign: Int, player: Player) {
        // 0 punten is toegestaan: zo telt de beurt mee voor de rondetelling.
        let delta = sign * max(0, amount ?? 0)
        let outcome = store.applyScore(delta, to: player.id, in: game.id)
        guard outcome != .ignored else { return }
        let entry = FloatEntry(playerId: player.id, delta: delta)
        floats.append(entry)
        Task {
            try? await Task.sleep(for: .milliseconds(900))
            floats.removeAll { $0.id == entry.id }
        }
        amount = 0
        // Door naar de volgende speler in invoervolgorde, zoals de PWA.
        if let i = game.players.firstIndex(where: { $0.id == player.id }) {
            selectedId = game.players[(i + 1) % game.players.count].id
        }
        if outcome == .finished { amountFocused = false }
    }

    private func nextTurn() {
        guard !game.players.isEmpty else { return }
        turnIdx = (turnIdx + 1) % game.players.count
        remaining = game.rules.timerSecs
        running = true
        selectedId = game.players[turnIdx].id
    }
}

// MARK: - Timer

/// Timer per beurt (zie `game/TurnTimer.tsx`).
private struct TurnTimerView: View {
    let player: Player
    let remaining: Int
    let total: Int
    let running: Bool
    let onReset: () -> Void
    let onToggle: () -> Void
    let onNext: () -> Void

    /// Telt op als de tijd op is; laat de kaart dan één keer schudden.
    @State private var shakes = 0

    private var low: Bool { remaining <= 5 && remaining > 0 }
    private var done: Bool { remaining == 0 }
    private var alarm: Color { low || done ? Theme.negative : Theme.text }

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 11) {
                PlayerAvatar(player, size: 40)
                VStack(alignment: .leading, spacing: 1) {
                    Text("AAN DE BEURT")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(Theme.muted)
                    Text(player.name)
                        .font(Theme.display(17))
                        .foregroundStyle(Theme.text)
                }
                Spacer()
                Text(Self.format(remaining))
                    .font(Theme.display(34, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(alarm)
                    .contentTransition(.numericText(countsDown: true))
                    .animation(.snappy, value: remaining)
            }
            GeometryReader { geo in
                Capsule().fill(Theme.surface2)
                    .overlay(alignment: .leading) {
                        Capsule().fill(low || done ? Theme.negative : Theme.accent)
                            .frame(width: geo.size.width * (total > 0 ? CGFloat(remaining) / CGFloat(total) : 0))
                            .animation(.linear(duration: 1), value: remaining)
                    }
            }
            .frame(height: 6)
            HStack(spacing: 8) {
                Button(action: onReset) {
                    Image(systemName: "arrow.counterclockwise")
                        .frame(width: 22)
                }
                .buttonStyle(SoftButtonStyle(compact: true))
                .accessibilityLabel("Reset timer")
                Button(action: onToggle) {
                    Label(running ? "Pauze" : "Start", systemImage: running ? "pause.fill" : "play.fill")
                }
                .buttonStyle(SoftButtonStyle())
                Button(action: onNext) {
                    HStack(spacing: 4) {
                        Text("Volgende")
                        Image(systemName: "chevron.right")
                    }
                }
                .buttonStyle(PrimaryButtonStyle(height: 42))
            }
        }
        .padding(14)
        .card()
        .keyframeAnimator(initialValue: 0.0, trigger: shakes) { view, x in
            view.offset(x: x)
        } keyframes: { _ in
            KeyframeTrack {
                LinearKeyframe(-8.0, duration: 0.06)
                LinearKeyframe(8.0, duration: 0.06)
                LinearKeyframe(-6.0, duration: 0.06)
                LinearKeyframe(6.0, duration: 0.06)
                LinearKeyframe(-3.0, duration: 0.06)
                LinearKeyframe(0.0, duration: 0.06)
            }
        }
        .onChange(of: done) { _, isDone in if isDone { shakes += 1 } }
        .sensoryFeedback(.warning, trigger: done) { _, isDone in isDone }
    }

    static func format(_ secs: Int) -> String {
        "\(secs / 60):\(String(format: "%02d", secs % 60))"
    }
}

// MARK: - Rijen en knoppen

private struct StepButton: View {
    let symbol: String
    let foreground: Color
    let background: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(foreground)
                .frame(width: 64, height: 64)
                .background(background, in: .rect(cornerRadius: Theme.Radius.stepper))
        }
        .buttonStyle(.plain)
    }
}

private struct PlayerRow: View {
    let player: Player
    let score: Int
    let isSelected: Bool
    let isLeader: Bool
    let isMaxed: Bool
    let floats: [FloatEntry]

    private var borderColor: Color? {
        if isSelected { return Color(hex: player.color) }
        if isMaxed { return Theme.gold }
        return nil
    }

    var body: some View {
        HStack(spacing: 12) {
            PlayerAvatar(player, size: 44)
                .overlay(alignment: .topTrailing) {
                    if isLeader {
                        Image(systemName: "trophy.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.white)
                            .frame(width: 20, height: 20)
                            .background(Theme.gold, in: .circle)
                            .overlay(Circle().strokeBorder(Theme.surface, lineWidth: 2))
                            .offset(x: 6, y: -6)
                    }
                }
            VStack(alignment: .leading, spacing: 1) {
                Text(player.name)
                    .font(Theme.display(18))
                    .foregroundStyle(Theme.text)
                if isMaxed {
                    Label("Max bereikt", systemImage: "flag.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.gold)
                } else if isSelected {
                    Text("geselecteerd")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color(hex: player.color))
                }
            }
            Spacer()
            Text("\(score)")
                .font(Theme.display(30, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(isLeader ? Theme.accent : Theme.text)
                .contentTransition(.numericText(value: Double(score)))
                .animation(.snappy, value: score)
                .overlay(alignment: .top) {
                    ZStack {
                        ForEach(floats) { FloatLabel(delta: $0.delta) }
                    }
                }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(.rect)
        .card(radius: Theme.Radius.row)
        .overlay {
            if let borderColor {
                RoundedRectangle(cornerRadius: Theme.Radius.row).strokeBorder(borderColor, lineWidth: 2)
            }
        }
        .background {
            if let borderColor {
                RoundedRectangle(cornerRadius: Theme.Radius.row)
                    .fill(Theme.surface)
                    .shadow(color: borderColor.opacity(0.2), radius: 9, y: 4)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// "+5" / "−3" die omhoog zweeft en vervaagt.
private struct FloatLabel: View {
    let delta: Int
    @State private var up = false

    var body: some View {
        Text(delta.signedString)
            .font(Theme.display(18, weight: .bold))
            .foregroundStyle(delta >= 0 ? Theme.positive : Theme.negative)
            .offset(y: up ? -34 : -8)
            .opacity(up ? 0 : 1)
            .onAppear { withAnimation(.easeOut(duration: 0.9)) { up = true } }
            .accessibilityHidden(true)
    }
}

extension Int {
    /// "+5", "−3", "0"
    var signedString: String { self > 0 ? "+\(self)" : self < 0 ? "−\(-self)" : "0" }
}

extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}

#Preview {
    let store = GameStore.preview
    return NavigationStack {
        ScoringView(gameId: store.games[0].id)
    }
    .environment(store)
    .environment(SyncEngine(store: store))
}

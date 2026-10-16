import SwiftUI
import PuntentellerKit

/// "Nieuw spel": spelregels kiezen en spelers toevoegen (zie `screens/NewGameScreen.tsx`).
/// Spelprofielen komen later (docs/ios-port.md).
struct NewGameView: View {
    var onStart: (Game) -> Void

    @Environment(GameStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private static let maxPlayers = 8

    @State private var name = ""
    @State private var scoring: Scoring = .high
    @State private var timerOn = false
    @State private var timerSecs = 60
    @State private var maxScoreOn = false
    @State private var maxScore = 100
    @State private var endMode: EndMode = .round
    @State private var maxRoundsOn = false
    @State private var maxRounds = 10
    @State private var sortPlayers = false
    @State private var players: [String] = []
    @State private var draft = ""
    @FocusState private var draftFocused: Bool

    private var canStart: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && players.count >= 2
    }

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Text("Nieuw spel")
                    .font(Theme.display(18))
                    .foregroundStyle(Theme.text)
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.text)
                            .frame(width: 40, height: 40)
                            .background(Theme.surface2, in: .circle)
                    }
                    .accessibilityLabel("Sluiten")
                    Spacer()
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    nameSection
                    scoringSection
                    timerSection
                    maxScoreSection
                    maxRoundsSection
                    sortSection
                    playersSection
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Theme.bg)
        .safeAreaInset(edge: .bottom) {
            BottomBar {
                Button(action: start) {
                    Label("Start spel", systemImage: "flag.fill")
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!canStart)
                if !canStart {
                    Text("Geef een naam op en voeg minstens 2 spelers toe")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.muted)
                }
            }
        }
        .animation(.snappy, value: timerOn)
        .animation(.snappy, value: maxScoreOn)
        .animation(.snappy, value: maxRoundsOn)
        .animation(.snappy, value: players)
    }

    // MARK: - Onderdelen

    private var nameSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Naam van het spel")
            TextField("bijv. Spelavond, Rummikub…", text: $name)
                .font(.system(size: 17))
                .textInputAutocapitalization(.sentences)
                .padding(.horizontal, 16)
                .frame(height: 54)
                .card(radius: 16)
        }
    }

    private var scoringSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Wie wint?")
            HStack(spacing: 4) {
                ForEach(Scoring.allCases, id: \.self) { option in
                    Button { scoring = option } label: {
                        HStack(spacing: 6) {
                            Image(systemName: option.symbol).foregroundStyle(Theme.accent)
                            Text(option.label).foregroundStyle(Theme.text)
                        }
                        .font(Theme.display(15))
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .background {
                            if scoring == option {
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Theme.surface)
                                    .shadow(color: Theme.text.opacity(0.08), radius: 4, y: 2)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(5)
            .background(Theme.surface2, in: .rect(cornerRadius: 15))
            .animation(.snappy, value: scoring)
        }
    }

    private var timerSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            ToggleRow(title: "Timer per beurt", isOn: $timerOn)
            if timerOn {
                HStack(spacing: 8) {
                    ForEach([30, 45, 60, 90], id: \.self) { secs in
                        Button { timerSecs = secs } label: {
                            Text("\(secs)s")
                                .font(Theme.display(15))
                                .foregroundStyle(timerSecs == secs ? Theme.accentText : Theme.text)
                                .frame(maxWidth: .infinity, minHeight: 38)
                                .background(timerSecs == secs ? Theme.accent : Theme.surface2, in: .capsule)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var maxScoreSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            ToggleRow(title: "Maximale score", isOn: $maxScoreOn)
            if maxScoreOn {
                NumberField(placeholder: "bijv. 100", value: $maxScore)
                VStack(spacing: 8) {
                    ForEach(EndMode.allCases, id: \.self) { mode in
                        Button { endMode = mode } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: endMode == mode ? "largecircle.fill.circle" : "circle")
                                    .foregroundStyle(endMode == mode ? Theme.accent : Theme.faint)
                                    .font(.system(size: 20))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(mode.title)
                                        .font(Theme.display(15))
                                        .foregroundStyle(Theme.text)
                                    Text(mode.explanation)
                                        .font(.system(size: 13))
                                        .foregroundStyle(Theme.muted)
                                        .multilineTextAlignment(.leading)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .card(radius: 16)
                            .overlay {
                                if endMode == mode {
                                    RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.accent, lineWidth: 2)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var maxRoundsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            ToggleRow(title: "Maximaal aantal rondes", isOn: $maxRoundsOn)
            if maxRoundsOn {
                NumberField(placeholder: "bijv. 10", value: $maxRounds)
            }
        }
    }

    private var sortSection: some View {
        ToggleRow(
            title: "Rangschikking op punten",
            subtitle: "Spelers automatisch sorteren op score",
            isOn: $sortPlayers
        )
    }

    private var playersSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                SectionLabel("Spelers")
                Spacer()
                Text("\(players.count)/\(Self.maxPlayers)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(players.count >= Self.maxPlayers ? Theme.accent : Theme.faint)
            }
            ForEach(Array(players.enumerated()), id: \.offset) { i, player in
                HStack(spacing: 12) {
                    PlayerAvatar(name: player, color: PlayerColors.color(at: i), size: 36)
                    Text(player)
                        .font(Theme.display(17))
                        .foregroundStyle(Theme.text)
                    Spacer()
                    Button { players.remove(at: i) } label: {
                        Image(systemName: "trash")
                            .foregroundStyle(Theme.muted)
                            .frame(width: 36, height: 36)
                    }
                    .accessibilityLabel("\(player) verwijderen")
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .card(radius: 16)
            }
            if players.count < Self.maxPlayers {
                HStack(spacing: 10) {
                    Image(systemName: "person.badge.plus")
                        .foregroundStyle(Theme.muted)
                        .frame(width: 36)
                    TextField("Naam speler toevoegen", text: $draft)
                        .focused($draftFocused)
                        .submitLabel(.next)
                        .onSubmit(addPlayer)
                    Button(action: addPlayer) {
                        Image(systemName: "plus")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Theme.accentText)
                            .frame(width: 38, height: 38)
                            .background(draftTrimmed.isEmpty ? Theme.faint : Theme.accent, in: .circle)
                    }
                    .disabled(draftTrimmed.isEmpty)
                    .accessibilityLabel("Speler toevoegen")
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Theme.surface2, in: .rect(cornerRadius: 16))
            }
        }
    }

    // MARK: - Acties

    private var draftTrimmed: String { draft.trimmingCharacters(in: .whitespaces) }

    private func addPlayer() {
        guard !draftTrimmed.isEmpty, players.count < Self.maxPlayers else { return }
        players.append(draftTrimmed)
        draft = ""
        // Toetsenbord open laten zodat je snel de volgende speler typt.
        draftFocused = players.count < Self.maxPlayers
    }

    private func start() {
        guard canStart else { return }
        let rules = GameRules(
            scoring: scoring,
            timerOn: timerOn,
            timerSecs: timerSecs,
            maxScore: maxScoreOn ? max(1, maxScore) : nil,
            maxRounds: maxRoundsOn ? max(1, maxRounds) : nil,
            endMode: endMode,
            sortPlayers: sortPlayers
        )
        onStart(store.startGame(name: name, rules: rules, playerNames: players))
    }
}

/// Rij met titel (+ optionele uitleg) en een iOS-schakelaar.
private struct ToggleRow: View {
    let title: String
    var subtitle: String?
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 2) {
                SectionLabel(title)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted)
                }
            }
        }
        .tint(Theme.positive)
    }
}

/// Numeriek invoerveld in kaart-stijl.
private struct NumberField: View {
    let placeholder: String
    @Binding var value: Int

    var body: some View {
        TextField(placeholder, value: $value, format: .number.grouping(.never))
            .keyboardType(.numberPad)
            .font(Theme.display(18))
            .padding(.horizontal, 16)
            .frame(height: 50)
            .card(radius: 16)
    }
}

extension EndMode {
    var title: String {
        switch self {
        case .immediate: "Direct stoppen"
        case .round: "Ronde afmaken"
        case .extraTurn: "Iedereen nog één beurt"
        }
    }

    var explanation: String {
        switch self {
        case .immediate: "Spel eindigt zodra de max bereikt is"
        case .round: "Resterende spelers in de ronde spelen hun beurt nog"
        case .extraTurn: "Alle overige spelers krijgen nog één beurt (bv. Duizendbommen)"
        }
    }
}

#Preview {
    NewGameView { _ in }
        .environment(GameStore(fileURL: nil))
}

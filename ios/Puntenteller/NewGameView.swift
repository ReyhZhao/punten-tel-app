import SwiftUI
import PuntentellerKit

/// "Nieuw spel": spelregels kiezen (of een spelprofiel toepassen) en spelers
/// toevoegen (zie `screens/NewGameScreen.tsx`).
struct NewGameView: View {
    var onStart: (Game) -> Void

    @Environment(GameStore.self) private var store
    @Environment(SyncEngine.self) private var sync
    @Environment(\.dismiss) private var dismiss

    private static let maxPlayers = 8

    @State private var name = ""
    @State private var activeProfile: GameProfile?
    @State private var scoring: Scoring = .high
    @State private var timerOn = false
    @State private var timerSecs = 60
    @State private var maxScoreOn = false
    @State private var maxScore = 100
    @State private var endMode: EndMode = .round
    @State private var maxRoundsOn = false
    @State private var maxRounds = 10
    @State private var sortPlayers = false
    @State private var players: [NewPlayer] = []
    @State private var participantsCanScore = false
    @State private var stayOnOwnPlayer = false
    /// Index van de speler die uitgenodigd wordt (sheet).
    @State private var invitingIndex: Int?
    @State private var draft = ""
    @FocusState private var nameFocused: Bool
    @FocusState private var draftFocused: Bool

    private var trimmedName: String { name.trimmingCharacters(in: .whitespaces) }

    private var canStart: Bool { !trimmedName.isEmpty && players.count >= 2 }

    private var rules: GameRules {
        GameRules(
            scoring: scoring,
            timerOn: timerOn,
            timerSecs: timerSecs,
            maxScore: maxScoreOn ? max(1, maxScore) : nil,
            maxRounds: maxRoundsOn ? max(1, maxRounds) : nil,
            endMode: endMode,
            sortPlayers: sortPlayers
        )
    }

    /// Profielen die bij de getypte naam passen (alles als het veld leeg is).
    private var profileSuggestions: [GameProfile] {
        store.profiles.filter { trimmedName.isEmpty || $0.name.localizedCaseInsensitiveContains(trimmedName) }
    }

    /// Alleen aanbieden als er nog geen profiel met deze naam is.
    private var isNewProfile: Bool { !trimmedName.isEmpty && store.profile(named: trimmedName) == nil }

    /// Bewaarde spelers die nog niet meedoen en bij de getypte naam passen.
    private var playerSuggestions: [SavedPlayer] {
        let draftKey = draft.trimmingCharacters(in: .whitespaces)
        return store.savedPlayers.filter { saved in
            !players.contains { $0.name.caseInsensitiveCompare(saved.name) == .orderedSame }
                && (draftKey.isEmpty || saved.name.localizedCaseInsensitiveContains(draftKey))
        }
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
                    if isNewProfile {
                        saveProfileButton
                    }
                    scoringSection
                    timerSection
                    maxScoreSection
                    maxRoundsSection
                    sortSection
                    playersSection
                    if sync.isSignedIn && players.contains(where: { $0.accountId != nil }) {
                        ToggleRow(
                            title: "Deelnemers mogen scores bijhouden",
                            subtitle: "Uitgenodigde spelers kunnen dan ook punten boeken",
                            isOn: $participantsCanScore
                        )
                        if participantsCanScore {
                            ToggleRow(
                                title: "Invoer op eigen speler",
                                subtitle: "Iedereen boekt op de eigen telefoon; na een boeking springt de invoer terug naar je eigen speler",
                                isOn: $stayOnOwnPlayer
                            )
                        }
                    }
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
        .onChange(of: name) { _, new in
            // Zelf typen maakt het gekozen profiel los, zoals in de PWA.
            if let activeProfile, new != activeProfile.name { self.activeProfile = nil }
        }
        .animation(.snappy, value: timerOn)
        .animation(.snappy, value: maxScoreOn)
        .animation(.snappy, value: maxRoundsOn)
        .animation(.snappy, value: players)
        .animation(.snappy, value: nameFocused)
        .animation(.snappy, value: draftFocused)
        .animation(.snappy, value: activeProfile?.id)
        .sheet(isPresented: Binding(get: { invitingIndex != nil }, set: { if !$0 { invitingIndex = nil } })) {
            if let i = invitingIndex, players.indices.contains(i) {
                InviteSheet(playerName: players[i].name, accountId: players[i].accountId) { accountId in
                    players[i].accountId = accountId
                    store.rememberAccount(accountId, forPlayerNamed: players[i].name)
                }
                .presentationDetents([.medium])
            }
        }
    }

    // MARK: - Naam / profiel

    private var nameSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Naam / profiel")
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .foregroundStyle(activeProfile != nil ? Theme.positive : Theme.faint)
                TextField("Zoek profiel of typ speltype…", text: $name)
                    .font(.system(size: 17))
                    .textInputAutocapitalization(.sentences)
                    .focused($nameFocused)
                    .submitLabel(.done)
                if activeProfile != nil {
                    Image(systemName: "checkmark")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.positive)
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 54)
            .card(radius: 16)

            if nameFocused && !profileSuggestions.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    SectionLabel("Profielen")
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 4)
                    ForEach(profileSuggestions) { profile in
                        Button { apply(profile) } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(profile.name)
                                    .font(Theme.display(16))
                                    .foregroundStyle(Theme.text)
                                BadgeRow(badges: profile.rules.badges)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .contentShape(.rect)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.bottom, 6)
                .card(radius: 16)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            if let activeProfile {
                BadgeRow(badges: rules.badges)
                    .padding(.leading, 4)
                    .accessibilityLabel("Profiel \(activeProfile.name) toegepast")
            }
        }
    }

    private var saveProfileButton: some View {
        Button {
            activeProfile = store.saveProfile(name: trimmedName, rules: rules)
        } label: {
            Label("Bewaar \"\(trimmedName)\" als profiel", systemImage: "sparkles")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(Theme.accent.opacity(0.1), in: .capsule)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Spelregels

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

    // MARK: - Spelers

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
                    PlayerAvatar(name: player.name, color: PlayerColors.color(at: i), size: 36)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(player.name)
                            .font(Theme.display(17))
                            .foregroundStyle(Theme.text)
                        if player.accountId != nil {
                            Text("Uitgenodigd")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Theme.positive)
                        }
                    }
                    Spacer()
                    if sync.isSignedIn {
                        Button { invitingIndex = i } label: {
                            Image(systemName: player.accountId != nil ? "person.crop.circle.badge.checkmark" : "envelope")
                                .foregroundStyle(player.accountId != nil ? Theme.positive : Theme.muted)
                                .frame(width: 36, height: 36)
                        }
                        .accessibilityLabel(player.accountId != nil ? "\(player.name) is uitgenodigd" : "\(player.name) uitnodigen")
                    }
                    Button { players.remove(at: i) } label: {
                        Image(systemName: "trash")
                            .foregroundStyle(Theme.muted)
                            .frame(width: 36, height: 36)
                    }
                    .accessibilityLabel("\(player.name) verwijderen")
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
                        .onSubmit { addPlayer(draft) }
                    Button { addPlayer(draft) } label: {
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

                if draftFocused && !playerSuggestions.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        SectionLabel("Eerder gespeeld")
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                            .padding(.bottom, 4)
                        ForEach(playerSuggestions.prefix(6)) { saved in
                            Button { addPlayer(saved.name) } label: {
                                HStack(spacing: 12) {
                                    PlayerAvatar(name: saved.name, color: saved.color, size: 30)
                                    Text(saved.name)
                                        .font(Theme.display(16))
                                        .foregroundStyle(Theme.text)
                                    Spacer()
                                    Image(systemName: "plus.circle.fill")
                                        .foregroundStyle(Theme.accent)
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .contentShape(.rect)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.bottom, 6)
                    .card(radius: 16)
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
    }

    // MARK: - Acties

    private var draftTrimmed: String { draft.trimmingCharacters(in: .whitespaces) }

    private func apply(_ profile: GameProfile) {
        activeProfile = profile
        name = profile.name
        let r = profile.rules
        scoring = r.scoring
        timerOn = r.timerOn
        timerSecs = r.timerSecs
        maxScoreOn = r.maxScore != nil
        maxScore = r.maxScore ?? 100
        maxRoundsOn = r.maxRounds != nil
        maxRounds = r.maxRounds ?? 10
        endMode = r.endMode
        sortPlayers = r.sortPlayers
        nameFocused = false
    }

    private func addPlayer(_ raw: String) {
        let name = raw.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, players.count < Self.maxPlayers else { return }
        // Eerder uitgenodigd? Dan direct weer met dat account (alleen met een account).
        let accountId = sync.isSignedIn ? store.savedPlayer(named: name)?.accountId : nil
        players.append(NewPlayer(name: name, accountId: accountId))
        draft = ""
        // Toetsenbord open laten zodat je snel de volgende speler typt.
        draftFocused = players.count < Self.maxPlayers
    }

    private func start() {
        guard canStart else { return }
        // Koppel aan het gekozen profiel, of aan een profiel met dezelfde naam
        // (voor de winst-statistiek per speltype), zoals de PWA.
        let profileId = activeProfile?.id ?? store.profile(named: trimmedName)?.id
        let invited = sync.isSignedIn && players.contains { $0.accountId != nil }
        onStart(store.startGame(
            name: trimmedName, rules: rules,
            players: sync.isSignedIn ? players : players.map { NewPlayer(name: $0.name) },
            profileId: profileId, participantsCanScore: invited && participantsCanScore,
            stayOnOwnPlayer: invited && participantsCanScore && stayOnOwnPlayer
        ))
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
        .environment(GameStore.preview)
        .environment(SyncEngine(store: GameStore.preview))
}

// app.jsx — root: state, persistence, actions, scaling, tweaks
const STORE_KEY = 'pwa-punten-v2';

function seedGames() {
  const now = Date.now();
  const mk = (name, scoring, names, scores, timerOn, timerSecs, ago, finished) => {
    const players = names.map((n, i) => ({ id: uid(), name: n, color: PLAYER_COLORS[i % PLAYER_COLORS.length], score: scores[i] }));
    const log = players.map((p) => ({ id: uid(), playerId: p.id, delta: p.score, ts: now - ago - 60000 }));
    return { id: uid(), name, scoring, timerOn, timerSecs, players, log, createdAt: now - ago, lastPlayed: now - ago, finished: !!finished };
  };
  return [
    mk('Yahtzee', 'high', ['Sanne', 'Tom', 'Lieke', 'Mees'], [212, 187, 245, 168], false, 60, 1000 * 60 * 35, false),
    mk('Golf kaarten', 'low', ['Anna', 'Bram', 'Noor'], [14, 9, 21], true, 45, 1000 * 60 * 60 * 26, false),
  ];
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { games: seedGames(), screen: 'home', currentId: null };
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "confetti",
  "avatars": "Initialen",
  "controls": "Boven"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [st, setSt] = React.useState(loadState);
  const { games, screen, currentId } = st;

  // persist
  React.useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) {}
  }, [st]);

  const theme = makeTheme(t.theme);
  const avatarStyle = t.avatars === 'Stippen' ? 'dot' : 'initials';

  // backdrop matches theme
  React.useEffect(() => {
    document.body.style.background = theme.stage;
  }, [theme.stage]);

  // scaling
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const fit = () => {
      const s = Math.min((window.innerHeight - 40) / 874, (window.innerWidth - 24) / 402, 1);
      setScale(s);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const patch = (updater) => setSt((s) => ({ ...s, ...updater(s) }));
  const updateGame = (id, fn) => setSt((s) => ({ ...s, games: s.games.map((g) => g.id === id ? fn(g) : g) }));

  const actions = {
    goHome: () => patch(() => ({ screen: 'home', currentId: null })),
    startNewGame: () => patch(() => ({ screen: 'new' })),
    createGame: (draft) => {
      const id = uid();
      const game = {
        id, name: draft.name, scoring: draft.scoring, timerOn: draft.timerOn, timerSecs: draft.timerSecs,
        players: draft.players.map((p) => ({ ...p, score: 0 })), log: [], createdAt: Date.now(), lastPlayed: Date.now(), finished: false,
      };
      setSt((s) => ({ ...s, games: [game, ...s.games], currentId: id, screen: 'scoring' }));
    },
    openGame: (id) => {
      const g = st.games.find((x) => x.id === id);
      patch(() => ({ currentId: id, screen: g && g.finished ? 'winner' : 'scoring' }));
    },
    applyScore: (gameId, playerId, delta) => updateGame(gameId, (g) => ({
      ...g, lastPlayed: Date.now(),
      players: g.players.map((p) => p.id === playerId ? { ...p, score: p.score + delta } : p),
      log: [...g.log, { id: uid(), playerId, delta, ts: Date.now() }],
    })),
    undoLog: (gameId, logId) => updateGame(gameId, (g) => {
      const entry = g.log.find((e) => e.id === logId);
      if (!entry) return g;
      return {
        ...g, lastPlayed: Date.now(),
        players: g.players.map((p) => p.id === entry.playerId ? { ...p, score: p.score - entry.delta } : p),
        log: g.log.filter((e) => e.id !== logId),
      };
    }),
    finishGame: (gameId) => { updateGame(gameId, (g) => ({ ...g, finished: true, lastPlayed: Date.now() })); patch(() => ({ screen: 'winner' })); },
    rematch: (gameId) => { updateGame(gameId, (g) => ({ ...g, finished: false, lastPlayed: Date.now(), players: g.players.map((p) => ({ ...p, score: 0 })), log: [] })); patch(() => ({ screen: 'scoring' })); },
    resetScores: (gameId) => updateGame(gameId, (g) => ({ ...g, players: g.players.map((p) => ({ ...p, score: 0 })), log: [] })),
    deleteGame: (gameId) => setSt((s) => ({ ...s, games: s.games.filter((g) => g.id !== gameId), screen: 'home', currentId: null })),
  };

  const current = games.find((g) => g.id === currentId);
  let screenEl;
  if (screen === 'new') screenEl = <NewGameScreen theme={theme} actions={actions} avatarStyle={avatarStyle} />;
  else if (screen === 'scoring' && current) screenEl = <ScoringScreen theme={theme} game={current} actions={actions} avatarStyle={avatarStyle} controlPos={t.controls === 'Onder' ? 'bottom' : 'top'} />;
  else if (screen === 'winner' && current) screenEl = <WinnerScreen theme={theme} game={current} actions={actions} avatarStyle={avatarStyle} />;
  else screenEl = <HomeScreen theme={theme} games={games} actions={actions} avatarStyle={avatarStyle} />;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
          <IOSDevice dark={theme.dark}>
            {screenEl}
          </IOSDevice>
        </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Stijl" />
        <TweakRadio label="Thema" value={t.theme}
          options={[{ value: 'confetti', label: 'Confetti' }, { value: 'arcade', label: 'Arcade' }, { value: 'pastel', label: 'Pastel' }]}
          onChange={(v) => setTweak('theme', v)} />
        <TweakRadio label="Spelers" value={t.avatars} options={['Initialen', 'Stippen']}
          onChange={(v) => setTweak('avatars', v)} />
        <TweakRadio label="Bediening" value={t.controls} options={['Boven', 'Onder']}
          onChange={(v) => setTweak('controls', v)} />
        <TweakSection label="Gegevens" />
        <TweakButton label="Voorbeeldspellen herstellen" onClick={() => setSt({ games: seedGames(), screen: 'home', currentId: null })} />
        <TweakButton label="Alles wissen" onClick={() => setSt({ games: [], screen: 'home', currentId: null })} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// screens.jsx — Avatar, Confetti, HomeScreen, NewGameScreen, WinnerScreen
// Exports to window: PlayerAvatar, Confetti, HomeScreen, NewGameScreen, WinnerScreen

function PlayerAvatar({ player, size = 40, avatarStyle = 'initials', ring = false, theme }) {
  const initials = (player.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0,
      background: player.color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: size * 0.4,
      boxShadow: ring ? `0 0 0 3px ${theme.surface}, 0 0 0 6px ${player.color}` : `inset 0 -2px 6px rgba(0,0,0,0.14)`,
      letterSpacing: 0.3,
    }}>
      {avatarStyle === 'initials' ? initials : ''}
    </div>
  );
}

function Confetti({ count = 90, colors }) {
  const pieces = React.useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: colors[i % colors.length],
    delay: Math.random() * 2.5,
    dur: 2.4 + Math.random() * 2.2,
    size: 7 + Math.random() * 8,
    rot: Math.random() * 360,
    round: Math.random() > 0.5,
    drift: (Math.random() - 0.5) * 80,
  })), [count]);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 30 }}>
      {pieces.map((p) => (
        <div key={p.id} style={{
          position: 'absolute', top: -20, left: `${p.left}%`,
          width: p.size, height: p.round ? p.size : p.size * 0.5,
          background: p.color, borderRadius: p.round ? '50%' : 2,
          ['--drift']: `${p.drift}px`,
          animation: `confettiFall ${p.dur}s linear ${p.delay}s infinite`,
          transform: `rotate(${p.rot}deg)`,
        }} />
      ))}
    </div>
  );
}

// ── HOME ───────────────────────────────────────────────────────
function HomeScreen({ theme, games, actions, avatarStyle }) {
  const t = theme;
  const sorted = [...games].sort((a, b) => b.lastPlayed - a.lastPlayed);
  const leaderOf = (g) => {
    if (!g.players.length) return null;
    const arr = [...g.players].sort((a, b) => g.scoring === 'low' ? a.score - b.score : b.score - a.score);
    return arr[0];
  };
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: t.bg }}>
      <div style={{ padding: '54px 22px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: t.accent }}>Puntenteller</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 38, lineHeight: 1.05, color: t.text, margin: '2px 0 0' }}>Spellen</h1>
        </div>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: t.accent, color: t.accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: t.dark ? t.glow : t.shadow }}>
          <Icon name="dice" size={28} />
        </div>
      </div>

      <div style={{ flex: 1, padding: '14px 18px 120px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sorted.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: 30, background: t.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.faint }}>
              <Icon name="dice" size={52} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 21, color: t.text }}>Nog geen spellen</div>
            <div style={{ fontSize: 15, color: t.muted, maxWidth: 240, lineHeight: 1.4 }}>Maak een nieuw spel aan, voeg je spelers toe en begin met punten tellen.</div>
          </div>
        )}

        {sorted.map((g) => {
          const leader = leaderOf(g);
          return (
            <Card key={g.id} theme={t} onClick={() => actions.openGame(g.id)} pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                      {g.finished && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: t.accent, background: t.surface2, padding: '3px 8px', borderRadius: 8, fontFamily: 'var(--font-display)' }}>KLAAR</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, color: t.muted, fontSize: 13.5 }}>
                      <Icon name={g.scoring === 'low' ? 'down' : 'up'} size={15} strokeWidth={2.4} style={{ color: t.accent }} />
                      <span>{g.scoring === 'low' ? 'Laagste wint' : 'Hoogste wint'}</span>
                      <span style={{ color: t.faint }}>·</span>
                      <span>{relTime(g.lastPlayed)}</span>
                    </div>
                  </div>
                  <Icon name="chevR" size={20} style={{ color: t.faint, marginTop: 4 }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: t.surface2 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {g.players.slice(0, 6).map((p, i) => (
                    <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                      <PlayerAvatar player={p} size={30} avatarStyle={avatarStyle} theme={{ ...t, surface: t.surface2 }} ring />
                    </div>
                  ))}
                  {g.players.length > 6 && <span style={{ marginLeft: 6, fontSize: 13, color: t.muted, fontWeight: 600 }}>+{g.players.length - 6}</span>}
                </div>
                {leader && g.log.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: t.text }}>
                    <Icon name="trophy" size={16} style={{ color: '#F4B400' }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{leader.name}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: t.accent }}>{leader.score}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 13.5, color: t.muted }}>{g.players.length} spelers</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 18px 38px', background: `linear-gradient(to top, ${t.bg} 62%, transparent)` }}>
        <Btn theme={t} full size="lg" onClick={actions.startNewGame}>
          <Icon name="plus" size={22} /> Nieuw spel
        </Btn>
      </div>
    </div>
  );
}

// ── NEW GAME ───────────────────────────────────────────────────
function NewGameScreen({ theme, actions, avatarStyle }) {
  const t = theme;
  const [name, setName] = React.useState('');
  const [scoring, setScoring] = React.useState('high');
  const [timerOn, setTimerOn] = React.useState(false);
  const [timerSecs, setTimerSecs] = React.useState(60);
  const [players, setPlayers] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef(null);

  const addPlayer = () => {
    const nm = draft.trim();
    if (!nm || players.length >= 8) return;
    setPlayers((ps) => [...ps, { id: uid(), name: nm, color: PLAYER_COLORS[ps.length % PLAYER_COLORS.length], score: 0 }]);
    setDraft('');
    if (inputRef.current) inputRef.current.focus();
  };
  const removePlayer = (id) => setPlayers((ps) => ps.filter((p) => p.id !== id).map((p, i) => ({ ...p, color: PLAYER_COLORS[i % PLAYER_COLORS.length] })));

  const canStart = name.trim().length > 0 && players.length >= 2;

  const Seg = ({ value, label, icon }) => {
    const active = scoring === value;
    return (
      <button onClick={() => setScoring(value)} style={{
        flex: 1, height: 44, border: 'none', borderRadius: 12, cursor: 'pointer',
        background: active ? t.surface : 'transparent', color: active ? t.text : t.muted,
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all .15s',
      }}>
        <Icon name={icon} size={17} style={{ color: active ? t.accent : t.muted }} /> {label}
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: t.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '52px 16px 6px' }}>
        <IconBtn theme={t} name="x" onClick={actions.goHome} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: t.text, whiteSpace: 'nowrap' }}>Nieuw spel</span>
        <div style={{ width: 44 }} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 18px 130px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Name */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: t.muted, margin: '0 0 8px 4px' }}>Naam van het spel</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="bijv. Spelavond, Rummikub…" style={{
            width: '100%', boxSizing: 'border-box', height: 54, padding: '0 18px', border: `1px solid ${t.border}`,
            borderRadius: 16, background: t.surface, color: t.text, fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 500, outline: 'none',
          }} />
        </div>

        {/* Scoring */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: t.muted, margin: '0 0 8px 4px' }}>Wie wint?</label>
          <div style={{ display: 'flex', gap: 6, padding: 5, background: t.surface2, borderRadius: 15 }}>
            <Seg value="high" label="Hoogste wint" icon="up" />
            <Seg value="low" label="Laagste wint" icon="down" />
          </div>
        </div>

        {/* Timer */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0' }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: t.muted }}>Timer per beurt</label>
            <button onClick={() => setTimerOn((v) => !v)} style={{ border: 'none', cursor: 'pointer', width: 52, height: 31, borderRadius: 16, padding: 2, background: timerOn ? '#34C759' : t.faint, transition: 'background .2s', display: 'flex' }}>
              <div style={{ width: 27, height: 27, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transform: timerOn ? 'translateX(21px)' : 'translateX(0)', transition: 'transform .2s' }} />
            </button>
          </div>
          {timerOn && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {[30, 45, 60, 90].map((s) => (
                <button key={s} onClick={() => setTimerSecs(s)} style={{
                  flex: 1, height: 44, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: timerSecs === s ? t.accent : t.surface2, color: timerSecs === s ? t.accentText : t.text,
                  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15,
                }}>{s}s</button>
              ))}
            </div>
          )}
        </div>

        {/* Players */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 8px' }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: t.muted }}>Spelers</label>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: players.length >= 8 ? t.accent : t.faint, fontFamily: 'var(--font-display)' }}>{players.length}/8</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: '8px 10px 8px 12px' }}>
                <PlayerAvatar player={p} size={36} avatarStyle={avatarStyle} theme={t} />
                <span style={{ flex: 1, fontSize: 16.5, fontWeight: 500, color: t.text, fontFamily: 'var(--font-display)' }}>{p.name}</span>
                <IconBtn theme={t} name="trash" size={36} iconSize={18} onClick={() => removePlayer(p.id)} bg="transparent" color={t.faint} />
              </div>
            ))}

            {players.length < 8 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.surface2, borderRadius: 16, padding: '6px 6px 6px 14px' }}>
                <Icon name="person" size={20} style={{ color: t.faint }} />
                <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(); }} placeholder="Naam speler toevoegen" style={{
                  flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 16.5, color: t.text, fontFamily: 'var(--font-display)', fontWeight: 500, minWidth: 0,
                }} />
                <IconBtn theme={t} name="plus" size={38} iconSize={22} onClick={addPlayer} bg={draft.trim() ? t.accent : t.faint} color={t.accentText} disabled={!draft.trim()} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px 18px 34px', background: `linear-gradient(to top, ${t.bg} 60%, transparent)` }}>
        <Btn theme={t} full size="lg" disabled={!canStart} onClick={() => actions.createGame({ name: name.trim(), scoring, timerOn, timerSecs, players })}>
          <Icon name="flag" size={20} /> Start spel
        </Btn>
        {!canStart && <div style={{ textAlign: 'center', fontSize: 12.5, color: t.muted, marginTop: 8 }}>Geef een naam op en voeg minstens 2 spelers toe</div>}
      </div>
    </div>
  );
}

// ── WINNER ─────────────────────────────────────────────────────
function WinnerScreen({ theme, game, actions, avatarStyle }) {
  const t = theme;
  const ranked = [...game.players].sort((a, b) => game.scoring === 'low' ? a.score - b.score : b.score - a.score);
  const winner = ranked[0];
  const podium = ranked.slice(0, 3);
  const order = [1, 0, 2]; // visual: 2nd, 1st, 3rd
  const heights = { 0: 120, 1: 88, 2: 68 };
  const medals = { 0: '#F4B400', 1: '#C7CBD1', 2: '#CD7F4D' };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', position: 'relative', background: t.dark ? t.bg : `linear-gradient(180deg, ${t.surface2} 0%, ${t.bg} 40%)` }}>
      <Confetti colors={PLAYER_COLORS} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '52px 16px 0', position: 'relative', zIndex: 31 }}>
        <IconBtn theme={t} name="x" onClick={actions.goHome} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 20px 20px', position: 'relative', zIndex: 31 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', color: t.accent }}>Winnaar</div>
        <div style={{ marginTop: 14 }}>
          <PlayerAvatar player={winner} size={92} avatarStyle={avatarStyle} theme={t} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, color: t.text, margin: '12px 0 0', textAlign: 'center' }}>{winner.name}</h1>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, color: t.accent, lineHeight: 1 }}>{winner.score}</span>
          <span style={{ fontSize: 15, color: t.muted, fontWeight: 600 }}>punten</span>
        </div>

        {/* Podium */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginTop: 26, width: '100%', maxWidth: 320 }}>
          {order.map((rankIdx) => {
            const p = podium[rankIdx];
            if (!p) return <div key={rankIdx} style={{ flex: 1 }} />;
            return (
              <div key={p.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <PlayerAvatar player={p} size={rankIdx === 0 ? 48 : 40} avatarStyle={avatarStyle} theme={t} />
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: 'var(--font-display)', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{
                  width: '100%', height: heights[rankIdx], borderRadius: '14px 14px 0 0',
                  background: t.surface, border: `1px solid ${t.border}`, borderBottom: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 12, gap: 4,
                  boxShadow: t.shadow,
                }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: medals[rankIdx], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{rankIdx + 1}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: t.text }}>{p.score}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full ranking */}
        {ranked.length > 3 && (
          <div style={{ width: '100%', marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ranked.slice(3).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: t.surface, borderRadius: 14, border: `1px solid ${t.border}` }}>
                <span style={{ width: 22, fontFamily: 'var(--font-display)', fontWeight: 700, color: t.muted, fontSize: 15 }}>{i + 4}</span>
                <PlayerAvatar player={p} size={30} avatarStyle={avatarStyle} theme={t} />
                <span style={{ flex: 1, fontSize: 15.5, color: t.text, fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: t.text }}>{p.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 18px 34px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 31 }}>
        <Btn theme={t} full size="lg" onClick={() => actions.rematch(game.id)}>
          <Icon name="reset" size={20} /> Opnieuw spelen
        </Btn>
        <Btn theme={t} full size="md" variant="soft" onClick={actions.goHome}>Terug naar spellen</Btn>
      </div>
    </div>
  );
}

Object.assign(window, { PlayerAvatar, Confetti, HomeScreen, NewGameScreen, WinnerScreen });

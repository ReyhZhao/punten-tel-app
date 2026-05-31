// game.jsx — ScoringScreen, TurnTimer, HistorySheet, ActionSheet
// Exports to window: ScoringScreen

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── iOS-style action sheet ─────────────────────────────────────
function ActionSheet({ theme, open, onClose, actions: items, title }) {
  const t = theme;
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.35)', animation: 'fadeIn .2s ease', padding: '0 10px 12px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1)' }}>
        <div style={{ background: t.surface, borderRadius: 18, overflow: 'hidden', marginBottom: 8 }}>
          {title && <div style={{ padding: '14px 16px 12px', textAlign: 'center', fontSize: 13, color: t.muted, borderBottom: `1px solid ${t.sep}` }}>{title}</div>}
          {items.map((it, i) => (
            <button key={i} onClick={() => { onClose(); it.onClick(); }} style={{
              width: '100%', border: 'none', cursor: 'pointer', background: 'transparent',
              padding: '17px 16px', fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 500,
              color: it.danger ? '#FF453A' : t.accent, borderTop: i ? `1px solid ${t.sep}` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>{it.icon && <Icon name={it.icon} size={19} />} {it.label}</button>
          ))}
        </div>
        <button onClick={onClose} style={{ width: '100%', border: 'none', cursor: 'pointer', background: t.surface, borderRadius: 18, padding: '17px 16px', fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: t.text }}>Annuleer</button>
      </div>
    </div>
  );
}

// ── History sheet ──────────────────────────────────────────────
function HistorySheet({ theme, open, onClose, game, onUndo, avatarStyle }) {
  const t = theme;
  if (!open) return null;
  const byId = Object.fromEntries(game.players.map((p) => [p.id, p]));
  const entries = [...game.log].reverse();
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 55, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.35)', animation: 'fadeIn .2s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.bg, borderRadius: '26px 26px 0 0', maxHeight: '80%', display: 'flex', flexDirection: 'column', animation: 'sheetUp .3s cubic-bezier(.2,.9,.3,1)', paddingBottom: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '14px 16px 10px' }}>
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 38, height: 5, borderRadius: 3, background: t.faint }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: t.text, marginTop: 6 }}>Historie</span>
          <button onClick={onClose} style={{ position: 'absolute', right: 14, top: 16, border: 'none', background: t.surface2, width: 32, height: 32, borderRadius: 16, color: t.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ overflow: 'auto', padding: '6px 16px 0' }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', color: t.muted, padding: '40px 20px', fontSize: 15 }}>
              <Icon name="list" size={40} style={{ color: t.faint, margin: '0 auto 12px' }} />
              Nog geen punten geboekt.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {entries.map((e) => {
                const p = byId[e.playerId];
                if (!p) return null;
                const pos = e.delta >= 0;
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.surface, borderRadius: 15, padding: '10px 10px 10px 12px', border: `1px solid ${t.border}` }}>
                    <PlayerAvatar player={p} size={36} avatarStyle={avatarStyle} theme={t} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 600, color: t.text, fontFamily: 'var(--font-display)' }}>{p.name}</div>
                      <div style={{ fontSize: 12.5, color: t.muted }}>{relTime(e.ts)}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: pos ? '#34C759' : '#FF453A' }}>{pos ? '+' : ''}{e.delta}</span>
                    <IconBtn theme={t} name="undo" size={36} iconSize={18} bg="transparent" color={t.muted} onClick={() => onUndo(e.id)} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Turn timer card ────────────────────────────────────────────
function TurnTimer({ theme, game, turnPlayer, remaining, running, onToggle, onReset, onNext, avatarStyle }) {
  const t = theme;
  const low = remaining <= 5 && remaining > 0;
  const done = remaining === 0;
  const frac = game.timerSecs ? remaining / game.timerSecs : 0;
  return (
    <div style={{ background: t.surface, borderRadius: 18, border: `1px solid ${done ? '#FF453A' : t.border}`, padding: '12px 14px', boxShadow: t.shadow, animation: done ? 'shake .4s ease' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <PlayerAvatar player={turnPlayer} size={40} avatarStyle={avatarStyle} theme={t} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: t.accent }}>Aan de beurt</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{turnPlayer.name}</div>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, color: done || low ? '#FF453A' : t.text, fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>{fmtTime(remaining)}</div>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: t.surface2, margin: '10px 0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${frac * 100}%`, background: done || low ? '#FF453A' : t.accent, borderRadius: 3, transition: 'width .9s linear' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn theme={t} size="sm" variant="soft" onClick={onReset} style={{ flex: '0 0 auto', paddingLeft: 14, paddingRight: 14 }}><Icon name="reset" size={17} /></Btn>
        <Btn theme={t} size="sm" variant="soft" onClick={onToggle} style={{ flex: 1 }}><Icon name={running ? 'pause' : 'play'} size={17} /> {running ? 'Pauze' : 'Start'}</Btn>
        <Btn theme={t} size="sm" onClick={onNext} style={{ flex: 1 }}>Volgende <Icon name="chevR" size={17} /></Btn>
      </div>
    </div>
  );
}

// ── Scoring screen ─────────────────────────────────────────────
function ScoringScreen({ theme, game, actions, avatarStyle, controlPos = 'top' }) {
  const t = theme;
  const [amount, setAmount] = React.useState('1');
  const [selectedId, setSelectedId] = React.useState(game.players[0] ? game.players[0].id : null);
  const [floats, setFloats] = React.useState([]); // {key, playerId, delta}
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  // timer state
  const [turnIdx, setTurnIdx] = React.useState(0);
  const [remaining, setRemaining] = React.useState(game.timerSecs || 60);
  const [running, setRunning] = React.useState(false);
  React.useEffect(() => {
    if (!game.timerOn || !running) return;
    if (remaining <= 0) { setRunning(false); return; }
    const id = setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearTimeout(id);
  }, [running, remaining, game.timerOn]);

  const turnPlayer = game.players[turnIdx] || game.players[0];
  const nextTurn = () => {
    const ni = (turnIdx + 1) % game.players.length;
    setTurnIdx(ni);
    setRemaining(game.timerSecs || 60);
    setRunning(true);
    setSelectedId(game.players[ni].id);
  };

  const amt = Math.max(0, parseInt(amount || '0', 10) || 0);
  const selected = game.players.find((p) => p.id === selectedId) || game.players[0];

  const apply = (sign) => {
    if (!selected || amt === 0) return;
    const delta = sign * amt;
    actions.applyScore(game.id, selected.id, delta);
    const key = uid();
    setFloats((f) => [...f, { key, playerId: selected.id, delta }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.key !== key)), 900);
  };

  const ranked = [...game.players].sort((a, b) => game.scoring === 'low' ? a.score - b.score : b.score - a.score);
  const rankOf = (id) => ranked.findIndex((p) => p.id === id);
  const leaders = game.log.length > 0 ? ranked.filter((p) => p.score === ranked[0].score).map((p) => p.id) : [];

  const controlCard = (
    <div style={{ background: t.surface, borderRadius: 22, border: `1px solid ${t.border}`, boxShadow: t.dark ? t.glow : t.shadow, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11, paddingLeft: 4 }}>
        <span style={{ fontSize: 13, color: t.muted }}>Punten voor</span>
        {selected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: t.surface2, padding: '3px 10px 3px 4px', borderRadius: 20 }}>
            <PlayerAvatar player={selected} size={22} avatarStyle={avatarStyle} theme={t} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: t.text }}>{selected.name}</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => apply(-1)} style={{
          width: 64, height: 64, borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: t.surface2, color: '#FF453A', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .1s',
        }} onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.92)'} onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'} onPointerLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
          <Icon name="minus" size={30} strokeWidth={3} />
        </button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} onFocus={(e) => e.target.select()} inputMode="numeric" style={{
            width: '100%', textAlign: 'center', border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, color: t.text, lineHeight: 1, padding: 0,
          }} />
          <span style={{ fontSize: 11.5, color: t.muted, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>aantal punten</span>
        </div>
        <button onClick={() => apply(1)} style={{
          width: 64, height: 64, borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: t.accent, color: t.accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: t.dark ? t.glow : 'none', transition: 'transform .1s',
        }} onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.92)'} onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'} onPointerLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
          <Icon name="plus" size={30} strokeWidth={3} />
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', position: 'relative', background: t.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '52px 12px 8px' }}>
        <IconBtn theme={t} name="back" onClick={actions.goHome} />
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.name}</div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 1 }}>{game.scoring === 'low' ? 'Laagste wint' : 'Hoogste wint'}</div>
        </div>
        <IconBtn theme={t} name="list" onClick={() => setHistoryOpen(true)} />
        <IconBtn theme={t} name="ellipsis" onClick={() => setMenuOpen(true)} />
      </div>

      {/* Control bar at top */}
      {controlPos === 'top' && (
        <div style={{ padding: '2px 16px 10px' }}>{controlCard}</div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', padding: controlPos === 'bottom' ? '4px 16px 160px' : '4px 16px 30px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {game.timerOn && turnPlayer && (
          <TurnTimer theme={t} game={game} turnPlayer={turnPlayer} remaining={remaining} running={running}
            onToggle={() => setRunning((r) => !r)} onReset={() => { setRemaining(game.timerSecs || 60); }} onNext={nextTurn} avatarStyle={avatarStyle} />
        )}

        {/* Players list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {ranked.map((p) => {
            const isSel = p.id === selectedId;
            const isLeader = leaders.includes(p.id);
            const myFloats = floats.filter((f) => f.playerId === p.id);
            return (
              <div key={p.id} onClick={() => setSelectedId(p.id)} style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 13,
                background: isSel ? (t.dark ? t.surface2 : t.surface) : t.surface,
                borderRadius: 18, padding: '12px 16px 12px 14px', cursor: 'pointer',
                border: `2px solid ${isSel ? p.color : 'transparent'}`,
                boxShadow: isSel ? `0 4px 18px ${p.color}33` : t.shadow,
                transition: 'border-color .15s, box-shadow .15s',
              }}>
                <div style={{ position: 'relative' }}>
                  <PlayerAvatar player={p} size={44} avatarStyle={avatarStyle} theme={t} />
                  {isLeader && (
                    <div style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, background: '#F4B400', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', border: `2px solid ${t.surface}` }}>
                      <Icon name="trophy" size={12} style={{ color: '#fff' }} />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  {isSel && <div style={{ fontSize: 12, fontWeight: 700, color: p.color, letterSpacing: 0.3 }}>geselecteerd</div>}
                </div>
                <div style={{ position: 'relative' }}>
                  <span key={p.score} style={{ display: 'inline-block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, color: t.text, fontVariantNumeric: 'tabular-nums', animation: 'pop .25s ease' }}>{p.score}</span>
                  {myFloats.map((f) => (
                    <span key={f.key} style={{ position: 'absolute', right: 0, top: -2, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: f.delta >= 0 ? '#34C759' : '#FF453A', animation: 'floatUp .9s ease forwards', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{f.delta >= 0 ? '+' : ''}{f.delta}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed control bar at bottom */}
      {controlPos === 'bottom' && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px 30px', background: `linear-gradient(to top, ${t.bg} 70%, transparent)` }}>
          {controlCard}
        </div>
      )}

      <HistorySheet theme={t} open={historyOpen} onClose={() => setHistoryOpen(false)} game={game} onUndo={(id) => actions.undoLog(game.id, id)} avatarStyle={avatarStyle} />
      <ActionSheet theme={t} open={menuOpen} onClose={() => setMenuOpen(false)} title={game.name} actions={[
        { label: 'Beëindig spel & toon winnaar', icon: 'trophy', onClick: () => actions.finishGame(game.id) },
        { label: 'Historie bekijken', icon: 'list', onClick: () => setHistoryOpen(true) },
        { label: 'Scores resetten', icon: 'reset', onClick: () => actions.resetScores(game.id) },
        { label: 'Spel verwijderen', icon: 'trash', danger: true, onClick: () => actions.deleteGame(game.id) },
      ]} />
    </div>
  );
}

Object.assign(window, { ScoringScreen, HistorySheet, ActionSheet, TurnTimer, fmtTime });

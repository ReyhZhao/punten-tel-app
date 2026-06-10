import React, { useState, useRef } from 'react';
import { Theme, Actions, Player, SavedPlayer, GameProfile, EndMode } from '../../types';
import { PLAYER_COLORS } from '../../theme';
import { uid } from '../../store';
import IconBtn from '../ui/IconBtn';
import Icon from '../ui/Icon';
import Btn from '../ui/Btn';
import PlayerAvatar from '../ui/PlayerAvatar';

interface Props {
  theme: Theme;
  actions: Actions;
  savedPlayers: SavedPlayer[];
  gameProfiles: GameProfile[];
}

export default function NewGameScreen({ theme, actions, savedPlayers, gameProfiles }: Props) {
  const t = theme;
  const [name, setName] = useState('');
  const [scoring, setScoring] = useState<'high' | 'low'>('high');
  const [timerOn, setTimerOn] = useState(false);
  const [timerSecs, setTimerSecs] = useState(60);
  const [maxScoreOn, setMaxScoreOn] = useState(false);
  const [maxScoreVal, setMaxScoreVal] = useState('100');
  const [endMode, setEndMode] = useState<EndMode>('round');
  const [sortPlayers, setSortPlayers] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [profileFocused, setProfileFocused] = useState(false);
  const [activeProfile, setActiveProfile] = useState<GameProfile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const applyProfile = (p: GameProfile) => {
    setActiveProfile(p);
    setName(p.name);
    setScoring(p.scoring);
    setTimerOn(p.timerOn);
    setTimerSecs(p.timerSecs);
    setMaxScoreOn(p.maxScore !== null);
    setMaxScoreVal(p.maxScore?.toString() ?? '100');
    setEndMode(p.endMode);
    setSortPlayers(p.sortPlayers);
  };

  const handleSaveProfile = () => {
    const profile: GameProfile = {
      id: uid(),
      name: name.trim(),
      scoring,
      timerOn,
      timerSecs,
      maxScore: maxScoreOn ? (parseInt(maxScoreVal, 10) || 100) : null,
      endMode,
      sortPlayers,
    };
    actions.saveProfile(profile);
    setActiveProfile(profile);
  };

  const profileSuggestions = gameProfiles.filter((p) =>
    name.trim() === '' || p.name.toLowerCase().includes(name.toLowerCase())
  );
  const showProfileDropdown = profileFocused && profileSuggestions.length > 0;
  const isNewProfile = name.trim() !== '' &&
    !gameProfiles.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());

  const settingsBadges = [
    scoring === 'high' ? 'Hoogste wint' : 'Laagste wint',
    ...(timerOn ? [`${timerSecs}s timer`] : []),
    ...(maxScoreOn ? [`Max ${parseInt(maxScoreVal) || 100}`] : []),
  ];

  const addPlayer = () => {
    const nm = draft.trim();
    if (!nm || players.length >= 8) return;
    setPlayers((ps) => [
      ...ps,
      { id: uid(), name: nm, color: PLAYER_COLORS[ps.length % PLAYER_COLORS.length], score: 0 },
    ]);
    setDraft('');
    inputRef.current?.focus();
  };

  const addSaved = (s: SavedPlayer) => {
    if (players.length >= 8) return;
    setPlayers((ps) => [
      ...ps,
      { id: uid(), name: s.name, color: PLAYER_COLORS[ps.length % PLAYER_COLORS.length], score: 0 },
    ]);
    setDraft('');
    inputRef.current?.focus();
  };

  const removePlayer = (id: string) =>
    setPlayers((ps) =>
      ps
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, color: PLAYER_COLORS[i % PLAYER_COLORS.length] }))
    );

  const suggestions = savedPlayers.filter(
    (s) =>
      !players.find((p) => p.name.toLowerCase() === s.name.toLowerCase()) &&
      (draft.trim() === '' || s.name.toLowerCase().includes(draft.toLowerCase()))
  );
  const showDropdown = focused && suggestions.length > 0;

  const canStart = name.trim().length > 0 && players.length >= 2;

  const SegBtn = ({ value, label, icon }: { value: 'high' | 'low'; label: string; icon: 'up' | 'down' }) => {
    const active = scoring === value;
    return (
      <button
        onClick={() => setScoring(value)}
        style={{
          flex: 1,
          height: 44,
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          background: active ? t.surface : 'transparent',
          color: active ? t.text : t.muted,
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
          transition: 'all .15s',
        }}
      >
        <Icon name={icon} size={17} style={{ color: active ? t.accent : t.muted }} />
        {label}
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: t.bg }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding:
            'max(52px, calc(env(safe-area-inset-top) + 16px)) 16px 6px',
        }}
      >
        <IconBtn theme={t} name="x" onClick={actions.goHome} />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 17,
            color: t.text,
          }}
        >
          Nieuw spel
        </span>
        <div style={{ width: 44 }} />
      </div>

      {/* Scrollable form */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 18px 130px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        {/* Naam / profiel combo */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: t.muted,
              margin: '0 0 8px 4px',
            }}
          >
            Naam / profiel
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: t.surface,
                border: `1.5px solid ${showProfileDropdown ? t.accent : activeProfile ? '#34C759' : t.border}`,
                borderRadius: showProfileDropdown ? '16px 16px 0 0' : 16,
                padding: '0 16px',
                height: 54,
                transition: 'border-color .15s, border-radius .15s',
              }}
            >
              <Icon
                name="spark"
                size={20}
                style={{ color: activeProfile ? '#34C759' : t.faint, flexShrink: 0 }}
              />
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setActiveProfile(null); }}
                onFocus={() => setProfileFocused(true)}
                onBlur={() => setTimeout(() => setProfileFocused(false), 150)}
                placeholder="Zoek profiel of typ speltype…"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 18,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  color: t.text,
                }}
              />
              {activeProfile && (
                <Icon name="check" size={18} style={{ color: '#34C759', flexShrink: 0 }} />
              )}
            </div>

            {showProfileDropdown && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  background: t.surface,
                  border: `1.5px solid ${t.accent}`,
                  borderTop: 'none',
                  borderRadius: '0 0 16px 16px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '6px 16px 4px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: t.muted,
                  }}
                >
                  Profielen
                </div>
                {profileSuggestions.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={() => applyProfile(p)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.surface2)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: t.text,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {p.name}
                    </span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                      {[
                        p.scoring === 'high' ? 'Hoogste wint' : 'Laagste wint',
                        ...(p.timerOn ? [`${p.timerSecs}s timer`] : []),
                        ...(p.maxScore != null ? [`Max ${p.maxScore}`] : []),
                      ].map((b) => (
                        <span
                          key={b}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: t.muted,
                            background: t.surface2,
                            padding: '2px 6px',
                            borderRadius: 5,
                          }}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeProfile && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6, paddingLeft: 4 }}>
              {settingsBadges.map((b) => (
                <span
                  key={b}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: t.muted,
                    background: t.surface2,
                    padding: '2px 7px',
                    borderRadius: 6,
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Scoring */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: t.muted,
              margin: '0 0 8px 4px',
            }}
          >
            Wie wint?
          </label>
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: 5,
              background: t.surface2,
              borderRadius: 15,
            }}
          >
            <SegBtn value="high" label="Hoogste wint" icon="up" />
            <SegBtn value="low" label="Laagste wint" icon="down" />
          </div>
        </div>

        {/* Timer */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 4px 0',
            }}
          >
            <label
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: t.muted,
              }}
            >
              Timer per beurt
            </label>
            <button
              onClick={() => setTimerOn((v) => !v)}
              style={{
                border: 'none',
                cursor: 'pointer',
                width: 52,
                height: 31,
                borderRadius: 16,
                padding: 2,
                background: timerOn ? '#34C759' : t.faint,
                transition: 'background .2s',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transform: timerOn ? 'translateX(21px)' : 'translateX(0)',
                  transition: 'transform .2s',
                }}
              />
            </button>
          </div>
          {timerOn && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {[30, 45, 60, 90].map((s) => (
                <button
                  key={s}
                  onClick={() => setTimerSecs(s)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 13,
                    border: 'none',
                    cursor: 'pointer',
                    background: timerSecs === s ? t.accent : t.surface2,
                    color: timerSecs === s ? t.accentText : t.text,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  {s}s
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Max score */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 4px 0',
            }}
          >
            <label
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: t.muted,
              }}
            >
              Maximaal aantal punten
            </label>
            <button
              onClick={() => setMaxScoreOn((v) => !v)}
              style={{
                border: 'none',
                cursor: 'pointer',
                width: 52,
                height: 31,
                borderRadius: 16,
                padding: 2,
                background: maxScoreOn ? '#34C759' : t.faint,
                transition: 'background .2s',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transform: maxScoreOn ? 'translateX(21px)' : 'translateX(0)',
                  transition: 'transform .2s',
                }}
              />
            </button>
          </div>
          {maxScoreOn && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={maxScoreVal}
                onChange={(e) => setMaxScoreVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                placeholder="bijv. 100"
                style={{
                  width: '100%',
                  height: 54,
                  padding: '0 18px',
                  border: `1px solid ${t.border}`,
                  borderRadius: 16,
                  background: t.surface,
                  color: t.text,
                  fontSize: 22,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: t.muted,
                    paddingLeft: 4,
                  }}
                >
                  Als de max bereikt is
                </div>
                {([
                  { mode: 'immediate', title: 'Direct stoppen', desc: 'Spel eindigt zodra de max bereikt is' },
                  { mode: 'round', title: 'Ronde afmaken', desc: 'Resterende spelers in de ronde spelen hun beurt nog' },
                  { mode: 'extraTurn', title: 'Iedereen nog één beurt', desc: 'Alle overige spelers krijgen nog één beurt (bv. Duizendbommen)' },
                ] as { mode: EndMode; title: string; desc: string }[]).map((opt) => {
                  const active = endMode === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      onClick={() => setEndMode(opt.mode)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        textAlign: 'left',
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 14,
                        cursor: 'pointer',
                        background: active ? t.surface : t.surface2,
                        border: `1.5px solid ${active ? t.accent : 'transparent'}`,
                        transition: 'border-color .15s, background .15s',
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          flexShrink: 0,
                          border: `2px solid ${active ? t.accent : t.faint}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {active && (
                          <div style={{ width: 10, height: 10, borderRadius: 5, background: t.accent }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: t.text,
                            fontFamily: 'var(--font-display)',
                          }}
                        >
                          {opt.title}
                        </div>
                        <div style={{ fontSize: 12, color: t.muted, marginTop: 1, lineHeight: 1.3 }}>
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sort players */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 4px 0',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: t.muted,
              }}
            >
              Rangschikking op punten
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
              Spelers automatisch sorteren op score
            </div>
          </div>
          <button
            onClick={() => setSortPlayers((v) => !v)}
            style={{
              border: 'none',
              cursor: 'pointer',
              width: 52,
              height: 31,
              borderRadius: 16,
              padding: 2,
              background: sortPlayers ? '#34C759' : t.faint,
              transition: 'background .2s',
              display: 'flex',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 27,
                height: 27,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                transform: sortPlayers ? 'translateX(21px)' : 'translateX(0)',
                transition: 'transform .2s',
              }}
            />
          </button>
        </div>

        {/* Save as profile */}
        {isNewProfile && (
          <button
            onClick={handleSaveProfile}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              border: `1.5px dashed ${t.border}`,
              borderRadius: 14,
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 14,
              color: t.muted,
            }}
          >
            <Icon name="spark" size={16} style={{ color: t.accent }} />
            Bewaar "{name.trim()}" als profiel
          </button>
        )}

        {/* Players */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '0 4px 8px',
            }}
          >
            <label
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: t.muted,
              }}
            >
              Spelers
            </label>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: players.length >= 8 ? t.accent : t.faint,
                fontFamily: 'var(--font-display)',
              }}
            >
              {players.length}/8
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 16,
                  padding: '8px 10px 8px 12px',
                }}
              >
                <PlayerAvatar player={p} size={36} theme={t} />
                <span
                  style={{
                    flex: 1,
                    fontSize: 16.5,
                    fontWeight: 500,
                    color: t.text,
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {p.name}
                </span>
                <IconBtn
                  theme={t}
                  name="trash"
                  size={36}
                  iconSize={18}
                  onClick={() => removePlayer(p.id)}
                  bg="transparent"
                  color={t.faint}
                />
              </div>
            ))}

            {players.length < 8 && (
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: t.surface2,
                    borderRadius: showDropdown ? '16px 16px 0 0' : 16,
                    padding: '6px 6px 6px 14px',
                    border: `1px solid ${showDropdown ? t.border : 'transparent'}`,
                    borderBottom: showDropdown ? 'none' : undefined,
                    transition: 'border-radius .15s',
                  }}
                >
                  <Icon name="person" size={20} style={{ color: t.faint }} />
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 150)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(); }}
                    placeholder="Naam speler toevoegen"
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: 16.5,
                      color: t.text,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      minWidth: 0,
                    }}
                  />
                  <IconBtn
                    theme={t}
                    name="plus"
                    size={38}
                    iconSize={22}
                    onClick={addPlayer}
                    bg={draft.trim() ? t.accent : t.faint}
                    color={t.accentText}
                    disabled={!draft.trim()}
                  />
                </div>

                {showDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      zIndex: 20,
                      background: t.surface,
                      border: `1px solid ${t.border}`,
                      borderTop: 'none',
                      borderRadius: '0 0 16px 16px',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 14px 4px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        color: t.muted,
                      }}
                    >
                      {draft.trim() ? 'Overeenkomsten' : 'Eerder gespeeld'}
                    </div>
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        onMouseDown={() => addSaved(s)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = t.surface2)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            background: s.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {s.name[0].toUpperCase()}
                        </div>
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 500,
                            color: t.text,
                            fontFamily: 'var(--font-display)',
                          }}
                        >
                          {s.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding:
            'max(16px, env(safe-area-inset-bottom)) 18px max(34px, calc(env(safe-area-inset-bottom) + 16px))',
          background: `linear-gradient(to top, ${t.bg} 60%, transparent)`,
        }}
      >
        <Btn
          theme={t}
          full
          size="lg"
          disabled={!canStart}
          onClick={() =>
            actions.createGame({
              name: name.trim(),
              scoring,
              timerOn,
              timerSecs,
              maxScore: maxScoreOn ? (parseInt(maxScoreVal, 10) || 100) : null,
              endMode,
              sortPlayers,
              players,
            })
          }
        >
          <Icon name="flag" size={20} /> Start spel
        </Btn>
        {!canStart && (
          <div
            style={{ textAlign: 'center', fontSize: 12.5, color: t.muted, marginTop: 8 }}
          >
            Geef een naam op en voeg minstens 2 spelers toe
          </div>
        )}
      </div>
    </div>
  );
}

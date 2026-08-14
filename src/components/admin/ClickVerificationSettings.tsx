 import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Spinner from '../Spinner';

const SHORTENER_API_BASE = 'https://go.animebing.in';

interface Settings {
  requireFullCycle: boolean;
  sessionExpiryMinutes: number;
  minDwellSeconds: number;
}

interface FunnelStats {
  stats: { _id: string; count: number }[];
  ipMismatchCount: number;
  flaggedUsers: number;
}

// ============================================================
// Design system notes
// ------------------------------------------------------------
// This now shares the exact same design tokens/vars as
// ShortenerManager.tsx (--bg1, --bg2, --border, --accent, etc.)
// so the two sections read as one continuous surface instead of
// two visually distinct blocks. HUD corner brackets are pulled
// tighter to the panel edge (no floating gap), and the overall
// scale (paddings, font sizes) is reduced to match the density
// of the rest of the admin UI.
// ============================================================

const COLORS = {
  amber: 'var(--amber)',
  cyan: 'var(--blue)',
  red: 'var(--red)',
  green: 'var(--green)',
};

const cvCss = `
.cv-root { width: 100%; }
.cv-section { margin-bottom: 16px; }

/* status strip */
.cv-strip {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 14px;
}
.cv-strip-left { display: flex; align-items: center; gap: 10px; }
.cv-dot { width: 8px; height: 8px; border-radius: 50%; animation: cvPulse 1.6s ease-in-out infinite; flex-shrink: 0; }
@keyframes cvPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.cv-title { font-size: 14px; font-weight: 600; color: var(--t1); letter-spacing: -0.2px; margin: 0; font-family: var(--font); }
.cv-subtitle { font-size: 10px; font-family: var(--mono); color: var(--t3); text-transform: uppercase; letter-spacing: 0.5px; margin: 2px 0 0; }
.cv-refresh {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 11px; border-radius: 7px;
  border: 1px solid var(--border); background: var(--bg2);
  color: var(--t2); font-size: 11px; font-family: var(--font);
  cursor: pointer; transition: all 0.13s;
}
.cv-refresh:hover:not(:disabled) { background: var(--bg3); border-color: var(--border2); color: var(--t1); }
.cv-refresh:disabled { opacity: 0.6; cursor: wait; }

/* readings grid */
.cv-readings {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 900px) { .cv-readings { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

/* generic HUD panel - same surface as ShortenerManager cards */
.cv-panel { position: relative; border: 1px solid var(--border); background: var(--bg1); border-radius: var(--radius); transition: border-color 0.15s; }
.cv-panel:hover { border-color: var(--border2); }
.cv-corner { position: absolute; width: 7px; height: 7px; pointer-events: none; }

.cv-eyebrow { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; margin: 0; color: var(--t3); font-family: var(--font); }
.cv-reading-value { margin-top: 6px; font-family: var(--mono); font-size: 20px; font-weight: 500; letter-spacing: -0.5px; font-variant-numeric: tabular-nums; }
.cv-reading-value .cv-suffix { font-size: 13px; }
.cv-reading-sub { margin-top: 2px; font-size: 11px; color: var(--t3); }
.cv-skeleton { margin-top: 10px; height: 24px; width: 56px; background: var(--bg3); border-radius: 4px; }

/* main 2-col grid */
.cv-main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
@media (max-width: 900px) { .cv-main-grid { grid-template-columns: 1fr; } }

.cv-armed-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.cv-armed-title { font-size: 13px; font-weight: 600; color: var(--t1); margin: 6px 0; font-family: var(--font); }
.cv-armed-desc { font-size: 12px; color: var(--t2); line-height: 1.55; margin: 0; }

.cv-dwell-block { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.cv-dwell-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.cv-dwell-input {
  width: 70px; background: var(--bg0); border: 1px solid var(--border2);
  border-radius: 6px; padding: 5px 10px; font-family: var(--mono); font-size: 12px;
  color: var(--t1); outline: none; transition: border-color 0.14s;
}
.cv-dwell-input:focus { border-color: rgba(124,106,247,0.5); }
.cv-dwell-unit { font-size: 10px; color: var(--t3); font-family: var(--mono); text-transform: uppercase; }
.cv-dwell-save {
  margin-left: auto; display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 11px; font-family: var(--font); font-size: 11px; font-weight: 600;
  border-radius: 7px; border: 1px solid var(--accent-border); cursor: pointer;
  background: var(--accent-dim); color: var(--accent); transition: background 0.13s;
}
.cv-dwell-save:hover:not(:disabled) { background: rgba(124,106,247,0.22); }
.cv-dwell-save:disabled { opacity: 0.6; cursor: wait; }
.cv-dwell-hint { margin-top: 6px; font-size: 10.5px; color: var(--t3); }

/* arm switch */
.cv-switch {
  position: relative; display: inline-flex; align-items: center;
  height: 24px; width: 46px; border-radius: 20px;
  border: 1px solid var(--border2); background: var(--bg0);
  cursor: pointer; padding: 0; flex-shrink: 0; transition: background-color 0.2s, border-color 0.2s;
}
.cv-switch:disabled { opacity: 0.6; cursor: wait; }
.cv-switch-knob { display: block; height: 17px; width: 17px; border-radius: 50%; background: var(--t3); transition: transform 0.2s; transform: translateX(2px); }

/* funnel panel */
.cv-funnel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.cv-funnel-window { font-size: 9.5px; font-family: var(--mono); color: var(--t3); text-transform: uppercase; }

.cv-funnel-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 0; text-align: center; }
.cv-funnel-empty-icon { width: 34px; height: 34px; border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; background: var(--bg2); }
.cv-funnel-empty-title { font-size: 12px; color: var(--t2); margin: 0; }
.cv-funnel-empty-sub { font-size: 10.5px; color: var(--t3); margin: 4px 0 0; }

.cv-drop { display: flex; align-items: center; gap: 6px; padding: 6px 0 6px 2px; font-size: 9.5px; font-family: var(--mono); }
.cv-drop-pct { color: var(--red); }
.cv-drop-label { color: var(--t3); }

.cv-stage-row { display: flex; align-items: center; gap: 10px; }
.cv-stage-label { width: 100px; flex-shrink: 0; font-size: 11px; color: var(--t2); text-transform: uppercase; letter-spacing: 0.02em; }
.cv-stage-track { flex: 1; height: 20px; background: var(--bg0); border: 1px solid var(--border); border-radius: 5px; position: relative; overflow: hidden; min-width: 0; }
.cv-stage-fill { height: 100%; transition: width 0.7s ease-out; }
.cv-stage-count { width: 50px; flex-shrink: 0; text-align: right; font-family: var(--mono); font-size: 11px; font-variant-numeric: tabular-nums; color: var(--t1); }

/* signal cards */
.cv-signals { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
@media (max-width: 700px) { .cv-signals { grid-template-columns: 1fr; } }
.cv-signal-card { display: flex; align-items: center; gap: 12px; }
.cv-signal-icon { width: 30px; height: 30px; border-radius: 7px; border: 1px solid; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cv-signal-icon span { font-family: var(--mono); font-size: 12px; font-weight: 700; }
.cv-signal-value { font-family: var(--mono); font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cv-signal-label { font-size: 10.5px; color: var(--t2); text-transform: uppercase; letter-spacing: 0.02em; margin-top: 1px; }

/* spinner-ish */
.cv-spin { animation: cvSpin 0.9s linear infinite; }
@keyframes cvSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.cv-error-wrap { max-width: 380px; margin: 0 auto; text-align: center; padding: 48px 0; }
.cv-error-icon { width: 38px; height: 38px; margin: 0 auto 12px; border-radius: 8px; border: 1px solid; display: flex; align-items: center; justify-content: center; }
.cv-error-title { color: var(--t1); font-weight: 600; margin: 0 0 4px; font-size: 13px; }
.cv-error-sub { font-size: 12px; color: var(--t2); margin: 0 0 14px; }
.cv-retry-btn { padding: 7px 14px; border-radius: 7px; border: 1px solid var(--accent-border); color: var(--accent); background: var(--accent-dim); font-family: var(--font); font-size: 11px; font-weight: 600; cursor: pointer; }
`;

// ---------- tiny inline spinner ----------
const Dot: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = 'var(--t2)' }) => (
  <svg
    className="cv-spin"
    style={{ width: size, height: size, color, flexShrink: 0 }}
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle style={{ opacity: 0.2 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path style={{ opacity: 0.9 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

function useCountUp(target: number, durationMs = 550) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

// ---------- HUD panel frame (tight to edge, no gap) ----------
const CORNER_POSITIONS: { top?: number; bottom?: number; left?: number; right?: number; borderTop?: boolean; borderBottom?: boolean; borderLeft?: boolean; borderRight?: boolean }[] = [
  { top: 0, left: 0, borderTop: true, borderLeft: true },
  { top: 0, right: 0, borderTop: true, borderRight: true },
  { bottom: 0, left: 0, borderBottom: true, borderLeft: true },
  { bottom: 0, right: 0, borderBottom: true, borderRight: true },
];

const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; tone?: 'default' | 'amber' | 'red' }> = ({
  children,
  style,
  tone = 'default',
}) => {
  const bracketColor = tone === 'amber' ? 'var(--amber)' : tone === 'red' ? 'var(--red)' : 'var(--border2)';
  return (
    <div className="cv-panel" style={style}>
      {CORNER_POSITIONS.map((pos, i) => (
        <span
          key={i}
          className="cv-corner"
          style={{
            top: pos.top,
            bottom: pos.bottom,
            left: pos.left,
            right: pos.right,
            borderTop: pos.borderTop ? `2px solid ${bracketColor}` : undefined,
            borderBottom: pos.borderBottom ? `2px solid ${bracketColor}` : undefined,
            borderLeft: pos.borderLeft ? `2px solid ${bracketColor}` : undefined,
            borderRight: pos.borderRight ? `2px solid ${bracketColor}` : undefined,
          }}
        />
      ))}
      {children}
    </div>
  );
};

const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'var(--t3)' }) => (
  <p className="cv-eyebrow" style={{ color }}>
    {children}
  </p>
);

// ---------- reading (stat) tile ----------
const Reading: React.FC<{
  label: string;
  value: number;
  suffix?: string;
  tone?: 'amber' | 'cyan' | 'green' | 'red';
  sub?: string;
  loading?: boolean;
}> = ({ label, value, suffix = '', tone = 'cyan', sub, loading }) => {
  const animated = useCountUp(loading ? 0 : value);
  const color = { amber: COLORS.amber, cyan: COLORS.cyan, green: COLORS.green, red: COLORS.red }[tone];

  return (
    <Panel style={{ padding: 12 }}>
      <Eyebrow>{label}</Eyebrow>
      {loading ? (
        <div className="cv-skeleton" />
      ) : (
        <p className="cv-reading-value" style={{ color }}>
          {animated.toLocaleString()}
          <span className="cv-suffix">{suffix}</span>
        </p>
      )}
      {sub && <p className="cv-reading-sub">{sub}</p>}
    </Panel>
  );
};

// ---------- funnel readout: waterfall bars with drop-off ----------
const FunnelReadout: React.FC<{
  stages: { key: string; label: string; count: number; color: string }[];
}> = ({ stages }) => {
  const max = stages[0]?.count || 0;

  if (max === 0) {
    return (
      <div className="cv-funnel-empty">
        <div className="cv-funnel-empty-icon">
          <svg style={{ width: 16, height: 16, color: 'var(--t3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v18M19 3v18M3 12h18" />
          </svg>
        </div>
        <p className="cv-funnel-empty-title">No signal yet</p>
        <p className="cv-funnel-empty-sub">Share shortlinks to start tracking sessions</p>
      </div>
    );
  }

  return (
    <div>
      {stages.map((stage, i) => {
        const widthPct = Math.max(4, Math.round((stage.count / max) * 100));
        const prev = i > 0 ? stages[i - 1] : null;
        const dropOff = prev && prev.count > 0 ? Math.round(((prev.count - stage.count) / prev.count) * 100) : null;

        return (
          <div key={stage.key}>
            {dropOff !== null && dropOff > 0 && (
              <div className="cv-drop">
                <span className="cv-drop-pct">▼ {dropOff}% LOST</span>
                <span className="cv-drop-label">before next stage</span>
              </div>
            )}
            <div className="cv-stage-row">
              <span className="cv-stage-label">{stage.label}</span>
              <div className="cv-stage-track">
                <div className="cv-stage-fill" style={{ width: `${widthPct}%`, backgroundColor: stage.color }} />
              </div>
              <span className="cv-stage-count">{stage.count.toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------- switch ----------
const ArmSwitch: React.FC<{ enabled: boolean; onChange: () => void; disabled?: boolean }> = ({
  enabled,
  onChange,
  disabled,
}) => (
  <button
    onClick={onChange}
    disabled={disabled}
    aria-pressed={enabled}
    aria-label="Toggle full cycle verification"
    className="cv-switch"
    style={{
      backgroundColor: enabled ? 'var(--amber-dim)' : 'var(--bg0)',
      borderColor: enabled ? 'var(--amber-border)' : 'var(--border2)',
    }}
  >
    <span
      className="cv-switch-knob"
      style={{
        backgroundColor: enabled ? 'var(--amber)' : 'var(--t3)',
        transform: enabled ? 'translateX(24px)' : 'translateX(2px)',
      }}
    />
  </button>
);

// ---------- signal card (IP mismatch / flagged users) ----------
const SignalCard: React.FC<{ value: number; label: string; tone: 'amber' | 'red' }> = ({ value, label, tone }) => {
  const color = tone === 'amber' ? 'var(--amber)' : 'var(--red)';
  const dimBg = tone === 'amber' ? 'var(--amber-dim)' : 'var(--red-dim)';
  const border = tone === 'amber' ? 'var(--amber-border)' : 'var(--red-border)';
  return (
    <Panel tone={tone} style={{ padding: 12 }}>
      <div className="cv-signal-card">
        <div className="cv-signal-icon" style={{ borderColor: border, background: dimBg }}>
          <span style={{ color }}>!</span>
        </div>
        <div>
          <div className="cv-signal-value" style={{ color }}>
            {value}
          </div>
          <div className="cv-signal-label">{label}</div>
        </div>
      </div>
    </Panel>
  );
};

// ============================================================
// Main component
// ============================================================

const ClickVerificationSettings: React.FC<{ token: string }> = ({ token }) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingDwell, setSavingDwell] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [dwellInput, setDwellInput] = useState<number>(3);
  const [dwellDirty, setDwellDirty] = useState(false);

  const loadData = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      try {
        const [settingsRes, statsRes] = await Promise.all([
          axios.get(`${SHORTENER_API_BASE}/admin/click-settings`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${SHORTENER_API_BASE}/admin/click-funnel-stats`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setSettings(settingsRes.data.data);
        setDwellInput(settingsRes.data.data.minDwellSeconds || 3);
        setDwellDirty(false);
        setFunnelStats(statsRes.data);
        setLoadError(false);
      } catch {
        setLoadError(true);
        toast.error('Failed to load click settings');
      } finally {
        setInitialLoading(false);
        if (showSpinner) setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggle = async () => {
    if (!settings) return;
    const newVal = !settings.requireFullCycle;
    setSaving(true);
    setSettings({ ...settings, requireFullCycle: newVal }); // optimistic
    try {
      await axios.put(
        `${SHORTENER_API_BASE}/admin/click-settings`,
        { requireFullCycle: newVal },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Full-cycle verification ${newVal ? 'ON' : 'OFF'} ho gaya!`);
    } catch {
      setSettings({ ...settings, requireFullCycle: !newVal }); // rollback
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const saveDwell = async () => {
    if (!settings || !dwellDirty) return;
    setSavingDwell(true);
    try {
      await axios.put(
        `${SHORTENER_API_BASE}/admin/click-settings`,
        { minDwellSeconds: dwellInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSettings({ ...settings, minDwellSeconds: dwellInput });
      setDwellDirty(false);
      toast.success('Dwell time updated!');
    } catch {
      toast.error('Update failed');
    } finally {
      setSavingDwell(false);
    }
  };

  const stats = useMemo(() => {
    if (!funnelStats) return { started: 0, animeViewed: 0, completed: 0, conversion: 0 };
    const get = (stage: string) => funnelStats.stats.find((s) => s._id === stage)?.count || 0;
    const started = get('started');
    const animeViewed = get('anime_viewed');
    const completed = get('completed');
    const conversion = started > 0 ? Math.round((completed / started) * 100) : 0;
    return { started, animeViewed, completed, conversion };
  }, [funnelStats]);

  const stageData = [
    { key: 'started', label: 'Started', count: stats.started, color: COLORS.cyan },
    { key: 'anime_viewed', label: 'Anime viewed', count: stats.animeViewed, color: COLORS.amber },
    { key: 'completed', label: 'Completed', count: stats.completed, color: COLORS.green },
  ];

  if (initialLoading) {
    return (
      <>
        <style>{cvCss}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
          <Spinner size="sm" text="Loading click settings..." />
        </div>
      </>
    );
  }

  if (loadError && !settings) {
    return (
      <>
        <style>{cvCss}</style>
        <div className="cv-error-wrap">
          <div className="cv-error-icon" style={{ borderColor: 'var(--red-border)', background: 'var(--red-dim)' }}>
            <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700 }}>!</span>
          </div>
          <h3 className="cv-error-title">Couldn't load click settings</h3>
          <p className="cv-error-sub">Check your connection and try again.</p>
          <button onClick={() => loadData()} className="cv-retry-btn">
            Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{cvCss}</style>
      <div className="cv-root cv-section">
        {/* Status strip */}
        <div className="cv-strip">
          <div className="cv-strip-left">
            <div className="cv-dot" style={{ backgroundColor: settings!.requireFullCycle ? 'var(--amber)' : 'var(--t3)' }} />
            <div>
              <h2 className="cv-title">Click Verification Console</h2>
              <p className="cv-subtitle">go.animebing.in / anti-fraud monitor</p>
            </div>
          </div>
          <button onClick={() => loadData(true)} disabled={refreshing} className="cv-refresh">
            {refreshing ? (
              <Dot size={12} />
            ) : (
              <i className="ti ti-refresh" style={{ fontSize: 13 }} />
            )}
            {refreshing ? 'Syncing' : 'Refresh'}
          </button>
        </div>

        {/* Readings */}
        <div className="cv-readings cv-section">
          <Reading label="Started" value={stats.started} sub="Sessions initiated" tone="cyan" loading={refreshing} />
          <Reading label="Anime viewed" value={stats.animeViewed} sub="Reached detail page" tone="amber" loading={refreshing} />
          <Reading label="Completed" value={stats.completed} sub="Full funnel done" tone="green" loading={refreshing} />
          <Reading label="Conversion" value={stats.conversion} suffix="%" sub="Completed / started" tone="cyan" loading={refreshing} />
        </div>

        {/* Main grid */}
        <div className="cv-main-grid">
          {/* Full-cycle verification control */}
          <Panel tone={settings!.requireFullCycle ? 'amber' : 'default'} style={{ padding: 16 }}>
            <div className="cv-armed-head">
              <div>
                <Eyebrow color={settings!.requireFullCycle ? 'var(--amber)' : 'var(--t3)'}>
                  {settings!.requireFullCycle ? '● Armed' : '○ Disarmed'}
                </Eyebrow>
                <h3 className="cv-armed-title">Full-Cycle Verification</h3>
                <p className="cv-armed-desc">
                  Jab <span style={{ color: 'var(--t1)', fontWeight: 500 }}>ON</span> ho, click tabhi count hoga jab user{' '}
                  <span style={{ color: 'var(--amber)', fontWeight: 500 }}>shortlink → anime page → download</span>{' '}
                  poora funnel complete karega.
                </p>
              </div>
              <ArmSwitch enabled={settings!.requireFullCycle} onChange={toggle} disabled={saving} />
            </div>

            {settings!.requireFullCycle && (
              <div className="cv-dwell-block">
                <Eyebrow>Minimum dwell time</Eyebrow>
                <div className="cv-dwell-row">
                  <input
                    type="number"
                    min={1}
                    value={dwellInput}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setDwellInput(val);
                      setDwellDirty(true);
                    }}
                    className="cv-dwell-input"
                  />
                  <span className="cv-dwell-unit">seconds</span>
                  {dwellDirty && (
                    <button onClick={saveDwell} disabled={savingDwell} className="cv-dwell-save">
                      {savingDwell && <Dot size={11} color="var(--accent)" />}
                      Save
                    </button>
                  )}
                </div>
                <p className="cv-dwell-hint">Bot/script protection — bahut fast completions block hongi.</p>
              </div>
            )}
          </Panel>

          {/* Funnel readout */}
          <Panel style={{ padding: 16 }}>
            <div className="cv-funnel-head">
              <Eyebrow>Funnel readout</Eyebrow>
              <span className="cv-funnel-window">Last 7 days</span>
            </div>
            <FunnelReadout stages={stageData} />
          </Panel>
        </div>

        {/* Signals */}
        <div className="cv-signals">
          <SignalCard value={funnelStats?.ipMismatchCount ?? 0} label="IP mismatches detected" tone="amber" />
          <SignalCard value={funnelStats?.flaggedUsers ?? 0} label="Flagged users for review" tone="red" />
        </div>
      </div>
    </>
  );
};

export default ClickVerificationSettings;
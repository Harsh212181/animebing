 import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Spinner from '../Spinner';

// ⚠️ Ye endpoints '/api' ke neeche nahi, root par mounted hain (shortenerRoutes)
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

const ClickVerificationSettings: React.FC<{ token: string }> = ({ token }) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [settingsRes, statsRes] = await Promise.all([
        axios.get(`${SHORTENER_API_BASE}/admin/click-settings`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${SHORTENER_API_BASE}/admin/click-funnel-stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setSettings(settingsRes.data.data);
      setFunnelStats(statsRes.data);
    } catch {
      toast.error('Failed to load click settings');
    }
  };

  useEffect(() => { loadData(); }, []);

  const toggle = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const newVal = !settings.requireFullCycle;
      await axios.put(`${SHORTENER_API_BASE}/admin/click-settings`,
        { requireFullCycle: newVal },
        { headers: { Authorization: `Bearer ${token}` } });
      setSettings({ ...settings, requireFullCycle: newVal });
      toast.success(`Full-cycle verification ${newVal ? 'ON' : 'OFF'} ho gaya!`);
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const updateDwell = async (val: number) => {
    if (!settings) return;
    try {
      await axios.put(`${SHORTENER_API_BASE}/admin/click-settings`,
        { minDwellSeconds: val },
        { headers: { Authorization: `Bearer ${token}` } });
      setSettings({ ...settings, minDwellSeconds: val });
    } catch {
      toast.error('Update failed');
    }
  };

  if (!settings) return <Spinner size="sm" />;

  const getCount = (stage: string) => funnelStats?.stats.find(s => s._id === stage)?.count || 0;
  const started = getCount('started');
  const completed = getCount('completed');
  const conversionRate = started > 0 ? ((completed / started) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
        <div>
          <h4 className="text-white font-medium">Full-Cycle Click Verification (Anti-Fraud)</h4>
          <p className="text-slate-400 text-xs mt-1">
            ON: click sirf tab count hoga jab user shortlink → anime page → shortener/download link — poora funnel complete kare (koi daily limit nahi).<br/>
            OFF: purana behavior — visit pe hi count, 24h same-IP dedupe.
          </p>
        </div>
        <button
          onClick={toggle} disabled={saving}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${settings.requireFullCycle ? 'bg-green-600' : 'bg-slate-600'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${settings.requireFullCycle ? 'translate-x-8' : 'translate-x-1'}`} />
        </button>
      </div>

      {settings.requireFullCycle && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <label className="text-sm text-slate-300">Minimum dwell time (seconds) before completion counts:</label>
          <input
            type="number" min={1} value={settings.minDwellSeconds}
            onChange={(e) => updateDwell(Math.max(1, parseInt(e.target.value) || 3))}
            className="w-24 ml-3 bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">Bot/script protection — bahut fast completions block karega.</p>
        </div>
      )}

      {funnelStats && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h4 className="text-white font-medium mb-2">Funnel Stats (Last 7 Days)</h4>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-900/50 p-2 rounded text-center">
              <div className="text-slate-400 text-xs">Started</div>
              <div className="text-white font-bold text-lg">{started}</div>
            </div>
            <div className="bg-slate-900/50 p-2 rounded text-center">
              <div className="text-slate-400 text-xs">Completed</div>
              <div className="text-green-400 font-bold text-lg">{completed}</div>
            </div>
            <div className="bg-slate-900/50 p-2 rounded text-center">
              <div className="text-slate-400 text-xs">Conversion</div>
              <div className="text-purple-400 font-bold text-lg">{conversionRate}%</div>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-400">
            <span>IP mismatches: <span className="text-yellow-400">{funnelStats.ipMismatchCount}</span></span>
            <span>Flagged users: <span className="text-red-400">{funnelStats.flaggedUsers}</span></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClickVerificationSettings;
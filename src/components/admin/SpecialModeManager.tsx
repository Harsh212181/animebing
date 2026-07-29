 import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface SpecialModeManagerProps {
  token?: string;
  apiBase: string;
}

type ModeType = 'weekday' | 'dateRange';

interface SpecialMode {
  _id: string;
  name: string;
  type: ModeType;
  weekdays?: number[];      // multi-day support (preferred)
  weekday?: number;         // legacy single-day (still read for old data)
  startDate?: string;
  endDate?: string;
  bannerText?: string;
  isEnabled: boolean;
  forceLink5Only?: boolean;
  createdAt?: string;
}

const WEEKDAYS = [
  { value: 0, label: 'Sun', full: 'Sunday' },
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' },
];

const getModeWeekdays = (m: SpecialMode): number[] =>
  m.weekdays && m.weekdays.length > 0 ? m.weekdays : (m.weekday !== undefined ? [m.weekday] : []);

const getIndiaToday = () => {
  const now = new Date();
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return { weekday: indiaTime.getDay(), dateOnly: new Date(indiaTime.getFullYear(), indiaTime.getMonth(), indiaTime.getDate()) };
};

const isModeActiveToday = (m: SpecialMode): boolean => {
  if (!m.isEnabled) return false;
  const { weekday, dateOnly } = getIndiaToday();
  if (m.type === 'weekday') return getModeWeekdays(m).includes(weekday);
  if (m.type === 'dateRange' && m.startDate && m.endDate) {
    const s = new Date(m.startDate); const e = new Date(m.endDate);
    const sOnly = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const eOnly = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    return dateOnly >= sOnly && dateOnly <= eOnly;
  }
  return false;
};

const SpecialModeManager: React.FC<SpecialModeManagerProps> = ({ token: propToken, apiBase }) => {
  const [modes, setModes] = useState<SpecialMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [masterLoading, setMasterLoading] = useState(false);

  // Drawer = only used for CREATE (new mode)
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Inline edit = shown below the specific row being edited
  const [editingMode, setEditingMode] = useState<SpecialMode | null>(null);

  const [saving, setSaving] = useState(false);
  const [rowToggling, setRowToggling] = useState<Record<string, boolean>>({});

  const [name, setName] = useState('');
  const [type, setType] = useState<ModeType>('weekday');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bannerText, setBannerText] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [forceLink5Only, setForceLink5Only] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const token = propToken || localStorage.getItem('adminToken');
  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => { fetchModes(); fetchMasterState(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteTarget) { setDeleteTarget(null); return; }
      if (drawerOpen && !saving) { closeDrawer(); return; }
      if (editingMode && !saving) { closeInlineEdit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, editingMode, saving, deleteTarget]);

  const fetchModes = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${apiBase}/special-modes`, authHeaders());
      setModes(data.data || []);
    } catch {
      toast.error('Failed to load special modes');
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterState = async () => {
    try {
      const { data } = await axios.get(`${apiBase}/link-settings`);
      setMasterEnabled(data.autoModeEnabled !== false);
    } catch { /* ignore */ }
  };

  const toggleMaster = async () => {
    setMasterLoading(true);
    try {
      const { data } = await axios.put(`${apiBase}/special-modes/master-toggle`, {}, authHeaders());
      setMasterEnabled(data.autoModeEnabled);
      toast.success(`System is now ${data.autoModeEnabled ? 'ON' : 'OFF'}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle');
    } finally {
      setMasterLoading(false);
    }
  };

  const resetForm = () => {
    setName(''); setType('weekday'); setSelectedWeekdays([0]);
    setStartDate(''); setEndDate(''); setBannerText('');
    setIsEnabled(true); setForceLink5Only(false);
  };

  // ---- CREATE (drawer, side panel) ----
  const openNewModeDrawer = () => {
    setEditingMode(null); // make sure inline edit is closed
    resetForm();
    setDrawerOpen(true);
  };
  const closeDrawer = () => { if (saving) return; setDrawerOpen(false); };

  // ---- EDIT (inline, below the row) ----
  const openInlineEdit = (mode: SpecialMode) => {
    setDrawerOpen(false); // make sure create-drawer is closed
    if (editingMode?._id === mode._id) {
      // clicking edit again on the same row collapses it
      setEditingMode(null);
      return;
    }
    setName(mode.name);
    setType(mode.type);
    setSelectedWeekdays(getModeWeekdays(mode).length ? getModeWeekdays(mode) : [0]);
    setStartDate(mode.startDate ? mode.startDate.slice(0, 10) : '');
    setEndDate(mode.endDate ? mode.endDate.slice(0, 10) : '');
    setBannerText(mode.bannerText || '');
    setIsEnabled(mode.isEnabled);
    setForceLink5Only(!!mode.forceLink5Only);
    setEditingMode(mode);
  };
  const closeInlineEdit = () => { if (saving) return; setEditingMode(null); };

  const toggleWeekdaySelection = (day: number) => {
    setSelectedWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  };

  const conflicts = useMemo(() => {
    const others = modes.filter(m => m._id !== editingMode?._id && m.isEnabled);
    if (type === 'weekday') {
      return others.filter(m => m.type === 'weekday' && getModeWeekdays(m).some(d => selectedWeekdays.includes(d)));
    }
    if (type === 'dateRange' && startDate && endDate) {
      const s = new Date(startDate); const e = new Date(endDate);
      return others.filter(m => {
        if (m.type !== 'dateRange' || !m.startDate || !m.endDate) return false;
        const ms = new Date(m.startDate); const me = new Date(m.endDate);
        return s <= me && e >= ms;
      });
    }
    return [];
  }, [modes, type, selectedWeekdays, startDate, endDate, editingMode]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (type === 'weekday' && selectedWeekdays.length === 0) { toast.error('Select at least one day'); return; }
    if (type === 'dateRange') {
      if (!startDate || !endDate) { toast.error('Start and end date required'); return; }
      if (new Date(endDate) < new Date(startDate)) { toast.error('End date must be after start date'); return; }
    }

    setSaving(true);
    const payload: any = {
      name: name.trim(),
      type,
      bannerText: bannerText.trim(),
      isEnabled,
      forceLink5Only,
    };
    if (type === 'weekday') payload.weekdays = selectedWeekdays;
    if (type === 'dateRange') { payload.startDate = startDate; payload.endDate = endDate; }

    try {
      if (editingMode) {
        await axios.put(`${apiBase}/special-modes/${editingMode._id}`, payload, authHeaders());
        toast.success('Mode updated!');
        setEditingMode(null);
      } else {
        await axios.post(`${apiBase}/special-modes`, payload, authHeaders());
        toast.success('Mode created!');
        setDrawerOpen(false);
      }
      fetchModes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => setDeleteTarget(id);
  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(`${apiBase}/special-modes/${deleteTarget}`, authHeaders());
      toast.success('Deleted!');
      if (editingMode?._id === deleteTarget) setEditingMode(null);
      fetchModes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleteTarget(null);
    }
  };

  const quickToggleEnabled = useCallback(async (m: SpecialMode) => {
    setRowToggling(prev => ({ ...prev, [m._id]: true }));
    setModes(prev => prev.map(x => x._id === m._id ? { ...x, isEnabled: !x.isEnabled } : x));
    try {
      await axios.put(`${apiBase}/special-modes/${m._id}`, { isEnabled: !m.isEnabled }, authHeaders());
      toast.success(`${m.name} ${!m.isEnabled ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      setModes(prev => prev.map(x => x._id === m._id ? { ...x, isEnabled: m.isEnabled } : x));
      toast.error(err.response?.data?.error || 'Toggle failed');
    } finally {
      setRowToggling(prev => ({ ...prev, [m._id]: false }));
    }
  }, [apiBase, token]);

  const describeMode = (m: SpecialMode) => {
    const base = m.type === 'weekday'
      ? getModeWeekdays(m).map(d => WEEKDAYS.find(w => w.value === d)?.full).join(', ') || '-'
      : `${m.startDate ? new Date(m.startDate).toLocaleDateString('en-IN') : '?'} \u2192 ${m.endDate ? new Date(m.endDate).toLocaleDateString('en-IN') : '?'}`;
    return m.forceLink5Only ? `${base} \u00b7 Link5 Only` : base;
  };

  const filteredModes = modes.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const activeToday = useMemo(() => modes.find(isModeActiveToday) || null, [modes]);

  const drawerClasses = `fixed inset-y-0 right-0 w-full sm:w-[520px] bg-slate-900/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl shadow-black/50 z-50 transform transition-transform duration-300 ease-in-out ${
    drawerOpen ? 'translate-x-0' : 'translate-x-full'
  }`;
  const backdropClasses = `fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
    drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
  }`;

  // ---- Shared form fields (used both in the create-drawer AND inline edit panel) ----
  const renderFormFields = () => (
    <>
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Mode Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Weekend Special, Diwali Dhamaka"
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Mode Type</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setType('weekday')}
            className={`py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
              type === 'weekday' ? 'bg-purple-600/20 border-purple-500/40 text-purple-200 shadow-md shadow-purple-500/10' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06] hover:border-white/20'
            }`}
          >
            Weekday(s)
          </button>
          <button
            onClick={() => setType('dateRange')}
            className={`py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
              type === 'dateRange' ? 'bg-purple-600/20 border-purple-500/40 text-purple-200 shadow-md shadow-purple-500/10' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06] hover:border-white/20'
            }`}
          >
            Date Range
          </button>
        </div>
      </div>

      {type === 'weekday' ? (
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
            Select Day(s) <span className="text-slate-600">- multiple allowed, e.g. Sat + Sun</span>
          </label>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map(w => {
              const selected = selectedWeekdays.includes(w.value);
              return (
                <button
                  key={w.value}
                  onClick={() => toggleWeekdaySelection(w.value)}
                  title={w.full}
                  className={`py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    selected ? 'bg-purple-600/30 border-purple-500/50 text-purple-200' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06]'
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">End Date</label>
            <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition" />
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg py-2 px-3">
          Overlaps with <b>{conflicts.map(c => c.name).join(', ')}</b>. Only the first enabled match (list order) will apply.
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
          Banner Message <span className="text-slate-600">(optional)</span>
        </label>
        <input
          value={bannerText}
          onChange={e => setBannerText(e.target.value)}
          placeholder="Download all anime & movies without any ads - only today!"
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 mb-1.5">Homepage Preview</p>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 p-1">
          <div className="rounded-lg bg-gradient-to-br from-purple-900/90 to-purple-800/90 px-4 py-3 backdrop-blur-sm border border-white/20">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{'\u{1F389}'}</span>
              <div>
                <h3 className="text-sm font-extrabold bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
                  {name.trim() || 'Mode Name'}!
                </h3>
                <p className="text-[11px] text-white/90">
                  {bannerText.trim() || 'Download all anime & movies without any ads - only during this mode!'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-black/30 border border-white/10 rounded-xl p-4 hover:border-white/20 transition">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input type="checkbox" checked={forceLink5Only} onChange={e => setForceLink5Only(e.target.checked)} className="w-5 h-5 mt-0.5 accent-purple-500 rounded" />
          <span>
            <span className="block text-sm font-semibold text-white">Force Link 5 Only</span>
            <span className="block text-xs text-slate-400 mt-0.5">
              When active, only Link 5 will be available during this mode. Other links auto-restore after it ends. Leave unchecked to just show the banner without touching links.
            </span>
          </span>
        </label>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input type="checkbox" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} className="w-5 h-5 accent-purple-500 rounded" />
        <span className="text-sm text-slate-300">Enabled</span>
      </label>
    </>
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-800/50 rounded-xl w-48" />
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-800/30 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Special Modes</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Set weekday(s) or festival date ranges to display a homepage banner and optionally force Link 5 only.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400">
            {masterLoading ? '...' : masterEnabled ? 'System ON' : 'System OFF'}
          </span>
          <button
            onClick={toggleMaster}
            disabled={masterLoading}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              masterEnabled ? 'bg-purple-600' : 'bg-slate-700'
            } ${masterLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-pressed={masterEnabled}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${masterEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {!masterEnabled && (
        <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/10 rounded-lg py-2 px-3 border border-amber-500/20">
          <span>Warning:</span>
          <span>System is OFF - no special mode will take effect regardless of individual settings.</span>
        </div>
      )}

      <div className={`rounded-xl p-4 border flex items-center gap-3 ${
        masterEnabled && activeToday ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/10'
      }`}>
        <span className="text-xl">{masterEnabled && activeToday ? '\ud83d\udfe2' : '\u26aa'}</span>
        <div>
          <p className="text-sm font-semibold text-white">
            {masterEnabled && activeToday ? `Active right now: ${activeToday.name}` : 'No special mode active right now'}
          </p>
          <p className="text-xs text-slate-500">
            {masterEnabled && activeToday
              ? (activeToday.forceLink5Only ? 'Link 5 only is being enforced.' : 'Banner is showing on homepage; links unaffected.')
              : 'Homepage banner is hidden until a mode matches today.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.5 10.5a7.5 7.5 0 0013.15 6.15z" /></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search modes..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-800/60 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
          />
        </div>
        <button
          onClick={openNewModeDrawer}
          className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-600/20 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Mode
        </button>
      </div>

      <div className="space-y-3">
        {filteredModes.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <h4 className="text-slate-400 font-medium mb-2">
              {searchQuery ? 'No matching modes found' : 'No special modes yet'}
            </h4>
            <p className="text-sm text-slate-600">
              {searchQuery ? 'Try a different search term.' : 'Click "New Mode" to create one.'}
            </p>
          </div>
        ) : (
          filteredModes.map(m => {
            const conflictsForRow = modes.filter(
              o => o._id !== m._id && o.isEnabled && m.isEnabled && o.type === 'weekday' && m.type === 'weekday' &&
                getModeWeekdays(o).some(d => getModeWeekdays(m).includes(d))
            );
            const isEditingThisRow = editingMode?._id === m._id;
            return (
              <div key={m._id}>
                <div
                  className={`bg-slate-800/30 backdrop-blur-md border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-all duration-200 ${
                    isEditingThisRow ? 'border-purple-500/50 rounded-b-none' : isModeActiveToday(m) ? 'border-emerald-500/40' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="text-base font-bold text-white">{m.name}</h5>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                        m.type === 'weekday' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      }`}>
                        {m.type === 'weekday' ? 'Weekday' : 'Festival'}
                      </span>
                      {m.forceLink5Only && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-purple-500/20 text-purple-300 border-purple-500/30">
                          Link5 Only
                        </span>
                      )}
                      {isModeActiveToday(m) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                          Live now
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{describeMode(m)}</p>
                    {m.bannerText && <p className="text-xs text-slate-500 mt-1 italic truncate">"{m.bannerText}"</p>}
                    {conflictsForRow.length > 0 && (
                      <p className="text-[11px] text-amber-400/90 mt-1.5 flex items-center gap-1">
                        Overlaps with: {conflictsForRow.map(c => c.name).join(', ')} - first match in list order wins.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => quickToggleEnabled(m)}
                      disabled={rowToggling[m._id]}
                      className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold border transition-all duration-200 min-w-[70px] flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                        m.isEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 hover:border-emerald-400'
                          : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 hover:border-red-400'
                      }`}
                    >
                      {rowToggling[m._id] ? (
                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (m.isEnabled ? 'Enabled' : 'Disabled')}
                    </button>
                    <button
                      onClick={() => openInlineEdit(m)}
                      className={`p-2 rounded-lg transition-all duration-200 ${isEditingThisRow ? 'text-purple-300 bg-purple-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100'}`}
                      title={isEditingThisRow ? 'Close editor' : 'Edit'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => confirmDelete(m._id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100" title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>

                {/* ✅ INLINE EDIT PANEL — opens directly below this row, no side drawer */}
                {isEditingThisRow && (
                  <div className="bg-slate-800/50 backdrop-blur-md border border-t-0 border-purple-500/50 rounded-b-2xl p-6 space-y-5 animate-[fadeIn_0.2s_ease]">
                    {renderFormFields()}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={closeInlineEdit}
                        disabled={saving}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold rounded-xl transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2"
                      >
                        {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Side drawer — used ONLY for creating a brand-new mode */}
      <div onClick={closeDrawer} className={backdropClasses}></div>
      <div className={drawerClasses} role="dialog" aria-modal="true">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <h4 className="text-lg font-bold text-white">Create New Mode</h4>
            <button onClick={closeDrawer} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {renderFormFields()}
          </div>

          <div className="p-5 border-t border-white/10">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              )}
              {saving ? 'Saving...' : 'Create Mode'}
            </button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}></div>
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete this mode?</h3>
            <p className="text-sm text-slate-400 mb-5">This action cannot be undone. Are you sure?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition">Cancel</button>
              <button onClick={executeDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 border border-red-500/30 rounded-xl transition shadow-lg shadow-red-600/20">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecialModeManager;
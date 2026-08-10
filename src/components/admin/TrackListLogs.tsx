// src/components/admin/TrackListLogs.tsx
import React, { useMemo, useState } from 'react';
import { RunLog } from '../../types/trackTypes';
import { Icon, formatIST } from '../../utils/trackUtils';

interface TrackListLogsProps {
  logs: any[];
  showLogs: boolean;
  setShowLogs: React.Dispatch<React.SetStateAction<boolean>>;
  clearAllLogs: () => void;
  clearingLogs: boolean;
  runs: RunLog[];
  showRunHistory: boolean;
  setShowRunHistory: React.Dispatch<React.SetStateAction<boolean>>;
  runAllNow: () => void;
  runningAll: boolean;
  clearAllRuns: () => void;
  clearingRuns: boolean;
}

// ============ small local helpers ============

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'abhi';
  if (min < 60) return `${min}m pehle`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h pehle`;
  const days = Math.floor(hr / 24);
  return `${days}d pehle`;
}

function SearchIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const ACTION_META: Record<string, { label: string; className: string; dot: string }> = {
  added: { label: 'Added', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', dot: 'bg-emerald-400' },
  replaced: { label: 'Replaced', className: 'bg-sky-500/10 text-sky-300 border-sky-500/20', dot: 'bg-sky-400' },
  'already-known': { label: 'Already known', className: 'bg-white/5 text-slate-500 border-white/10', dot: 'bg-slate-500' },
  'no-format-detected': { label: 'No format', className: 'bg-amber-500/10 text-amber-300 border-amber-500/20', dot: 'bg-amber-400' },
  'season-blocked': { label: 'Season blocked', className: 'bg-amber-500/10 text-amber-300 border-amber-500/20', dot: 'bg-amber-400' },
  'limit-blocked': { label: 'Limit blocked', className: 'bg-red-500/10 text-red-300 border-red-500/20', dot: 'bg-red-400' },
  'needs-approval': { label: 'Approval pending', className: 'bg-blue-500/10 text-blue-300 border-blue-500/20', dot: 'bg-blue-400' },
};
const ACTION_FILTERS = ['all', ...Object.keys(ACTION_META)] as const;

const TrackListLogs: React.FC<TrackListLogsProps> = ({
  logs,
  showLogs,
  setShowLogs,
  clearAllLogs,
  clearingLogs,
  runs,
  showRunHistory,
  setShowRunHistory,
  runAllNow,
  runningAll,
  clearAllRuns,
  clearingRuns,
}) => {
  const [logSearch, setLogSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<(typeof ACTION_FILTERS)[number]>('all');

  // ---- Run history derived stats ----
  const latestRun = runs[0];
  const totalUpdates = runs.reduce((sum, r) => sum + r.updatesFound, 0);
  const totalErrors = runs.reduce((sum, r) => sum + r.errorCount, 0);
  const successRate =
    runs.length > 0
      ? Math.round(((runs.length - runs.filter((r) => r.errorCount > 0).length) / runs.length) * 100)
      : null;

  // ---- Filtered logs (search + action type) ----
  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs
      .map((log: any) => {
        if (q && !log.channelName.toLowerCase().includes(q)) return null;
        if (actionFilter === 'all') return log;
        const filteredTitles = log.titles
          .map((t: any) => ({ ...t, entries: t.entries.filter((e: any) => e.action === actionFilter) }))
          .filter((t: any) => t.entries.length > 0);
        if (filteredTitles.length === 0) return null;
        return { ...log, titles: filteredTitles };
      })
      .filter(Boolean);
  }, [logs, logSearch, actionFilter]);

  return (
    <>
      {/* ============ Run History ============ */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div
          onClick={() => setShowRunHistory((v) => !v)}
          className="flex items-center justify-between p-4 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition"
        >
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className={`transition-transform ${showRunHistory ? 'rotate-90' : ''}`}>
              {Icon.chevronRight('w-3.5 h-3.5 text-slate-500')}
            </span>
            {Icon.history('w-4 h-4 text-slate-400')} Run History
            {runs.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 font-medium">
                {runs.length}
              </span>
            )}
          </h4>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={runAllNow}
              disabled={runningAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-slate-200 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {runningAll ? Icon.spinner('w-3.5 h-3.5') : Icon.play('w-3.5 h-3.5')}
              Test Run
            </button>
            {runs.length > 0 && (
              <button
                onClick={clearAllRuns}
                disabled={clearingRuns}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {clearingRuns ? Icon.spinner('w-3.5 h-3.5') : Icon.trash('w-3.5 h-3.5')}
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Always-visible quick stats strip, even when collapsed */}
        {runs.length > 0 && (
          <div className="grid grid-cols-4 divide-x divide-white/5 border-b border-white/5 bg-black/10">
            {[
              { label: 'Last Run', value: timeAgo(latestRun.runAt) },
              { label: 'Total Runs', value: String(runs.length) },
              { label: 'Total Updates', value: String(totalUpdates) },
              {
                label: 'Success Rate',
                value: successRate !== null ? `${successRate}%` : '—',
                accent: successRate !== null && successRate < 90 ? 'text-amber-300' : 'text-emerald-300',
              },
            ].map((stat) => (
              <div key={stat.label} className="px-3 py-2.5 text-center">
                <p className={`text-sm font-bold ${(stat as any).accent || 'text-white'}`}>{stat.value}</p>
                <p className="text-[9px] uppercase tracking-wide text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {showRunHistory && (
          <div className="p-4">
            {runs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                Abhi tak koi automatic run nahi hua — cron din me 2 baar (8 AM, 8 PM IST) chalega.
              </p>
            ) : (
              <div className="relative max-h-[320px] overflow-y-auto pr-1">
                {/* vertical timeline line */}
                <div className="absolute left-[5px] top-1 bottom-1 w-px bg-white/10" />
                <div className="space-y-2">
                  {runs.map((r) => {
                    const status = r.errorCount > 0 ? 'error' : r.updatesFound > 0 ? 'updates' : 'clean';
                    const dotClass =
                      status === 'error' ? 'bg-red-400' : status === 'updates' ? 'bg-emerald-400' : 'bg-slate-500';
                    return (
                      <div key={r._id} className="relative pl-6">
                        <span
                          className={`absolute left-0 top-3 w-[11px] h-[11px] rounded-full border-2 border-slate-900 ${dotClass}`}
                        />
                        <div className="flex items-center justify-between bg-black/20 rounded-xl px-3 py-2.5 text-xs border border-white/5">
                          <div className="flex flex-col flex-shrink-0">
                            <span className="text-slate-300 font-medium">{timeAgo(r.runAt)}</span>
                            <span className="text-slate-600 text-[10px]">{formatIST(r.runAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                              {r.channelsChecked} channels
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full border ${
                                r.updatesFound > 0
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-semibold'
                                  : 'bg-white/5 text-slate-500 border-white/10'
                              }`}
                            >
                              {r.updatesFound > 0 ? `${r.updatesFound} updates` : 'no updates'}
                            </span>
                            {r.errorCount > 0 && (
                              <span
                                className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 flex items-center gap-1"
                                title={r.errorChannels?.join(', ')}
                              >
                                {Icon.warn('w-3 h-3')} {r.errorCount} error
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============ Check Logs ============ */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div
          onClick={() => setShowLogs((v) => !v)}
          className="flex items-center justify-between p-4 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className={`transition-transform ${showLogs ? 'rotate-90' : ''}`}>
              {Icon.chevronRight('w-3.5 h-3.5 text-slate-500')}
            </span>
            {Icon.history('w-4 h-4 text-slate-400')} Check Logs (Diagnostic)
            {logs.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 font-medium">
                {logs.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {totalErrors > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 hidden sm:inline">
                {totalErrors} total errors
              </span>
            )}
            {logs.length > 0 && (
              <button
                onClick={clearAllLogs}
                disabled={clearingLogs}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {clearingLogs ? Icon.spinner('w-3.5 h-3.5') : Icon.trash('w-3.5 h-3.5')}
                Clear Logs
              </button>
            )}
          </div>
        </div>

        {showLogs && (
          <div className="p-4">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                Abhi tak koi check log nahi hai. "Check Now" ya "Test Run" dabao.
              </p>
            ) : (
              <>
                {/* Search bar */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <div className="relative flex-1 min-w-[160px]">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                      <SearchIcon />
                    </span>
                    <input
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Channel se search karo..."
                      className="w-full text-xs bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/25 transition"
                    />
                  </div>
                </div>

                {/* Action-type filter chips */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  {ACTION_FILTERS.map((f) => {
                    const active = actionFilter === f;
                    const meta = f === 'all' ? null : ACTION_META[f];
                    return (
                      <button
                        key={f}
                        onClick={() => setActionFilter(f)}
                        className={`text-[10px] px-2 py-1 rounded-full border transition flex items-center gap-1 ${
                          active
                            ? 'bg-white/15 border-white/25 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        {meta && <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />}
                        {f === 'all' ? 'All' : meta!.label}
                      </button>
                    );
                  })}
                </div>

                {filteredLogs.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">Filter se koi log match nahi hua.</p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {filteredLogs.map((log: any) => {
                      const totalEntries = log.titles.reduce((sum: number, t: any) => sum + t.entries.length, 0);
                      return (
                        <details
                          key={log._id}
                          className="bg-black/20 rounded-xl border border-white/5 overflow-hidden group"
                        >
                          <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-white/[0.03] transition list-none">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-slate-500 flex-shrink-0 transition-transform group-open:rotate-90">
                                {Icon.chevronRight('w-3.5 h-3.5')}
                              </span>
                              <span className="text-xs font-semibold text-white truncate">{log.channelName}</span>
                              <span className="text-[10px] text-slate-500 flex-shrink-0">
                                · {log.titles.length} title(s) · {totalEntries} entries
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 flex-shrink-0">{formatIST(log.runAt)}</span>
                          </summary>

                          <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                            <p className="text-[10px] text-slate-500">{log.totalRecentVideos} recent videos fetched</p>
                            {log.titles.map((t: any, i: number) => (
                              <div key={i} className="bg-black/30 rounded-lg p-2.5 border border-white/5">
                                <p className="text-[11px] font-medium text-slate-300 mb-1">
                                  "{t.keyword}" — {t.matchedVideoCount} matched
                                </p>
                                {t.entries.length === 0 ? (
                                  <p className="text-[10px] text-slate-500">Koi video keyword se match nahi hua.</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {t.entries.map((e: any, j: number) => {
                                      const meta = ACTION_META[e.action];
                                      return (
                                        <div key={j} className="flex items-start gap-2 text-[10px]">
                                          <span
                                            className={`px-1.5 py-0.5 rounded border flex-shrink-0 font-medium ${
                                              meta?.className || 'bg-white/5 text-slate-400 border-white/10'
                                            }`}
                                          >
                                            {meta?.label || e.action}
                                          </span>
                                          <span className="text-slate-500 truncate">
                                            Part {e.part ?? '—'}{e.isRange ? ' (range)' : ''} ·{' '}
                                            <span className="text-slate-400">{e.videoTitle}</span>
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default TrackListLogs;
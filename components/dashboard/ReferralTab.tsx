import React, { useState, useEffect } from 'react';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users';

interface ReferralInfo {
  referralCode: string;
  referralLink: string;
  rewards: {
    referrerReward: number;
    referredReward: number;
    commissionPercent: number;
    unlockThreshold: number;
  };
}

interface ReferralItem {
  _id: string;
  referredUsername: string;
  referredRealName: string;
  status: 'pending' | 'unlocked' | 'flagged';
  referrerReward: number;
  currentClicks: number;
  unlockThreshold: number;
  clicksRemaining: number;
  progressPercent: number;
  joinedAt: string;
  unlockedAt: string | null;
  isActive: boolean;
}

interface ReferralData {
  summary: {
    totalReferred: number;
    unlockedCount: number;
    pendingCount: number;
    totalEarnedFromReferrals: number;
    estimatedCommissionEarnings: number;
    commissionPercent: number;
  };
  referrals: ReferralItem[];
}

const ReferralTab: React.FC<{ token: string; onToast: (text: string, type?: 'success' | 'error') => void }> = ({ token, onToast }) => {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [infoRes, dataRes] = await Promise.all([
        fetch(`${API_BASE}/referral/my-code`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/referral/my-referrals`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const infoJson = await infoRes.json();
      const dataJson = await dataRes.json();
      if (infoJson.error) { onToast(infoJson.error, 'error'); }
      else setInfo(infoJson);
      if (dataJson.error) { onToast(dataJson.error, 'error'); }
      else setData(dataJson);
    } catch {
      onToast('Network error loading referral data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!info) return;
    navigator.clipboard.writeText(info.referralLink);
    setCopied(true);
    onToast('Referral link copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (!info) return;
    if (navigator.share) {
      navigator.share({
        title: 'Join AnimaBing',
        text: `Join AnimaBing using my referral link and get ₹${info.rewards.referredReward} bonus!`,
        url: info.referralLink,
      }).catch(() => {});
    } else {
      copyLink();
    }
  };

  const cardCls = "rounded-xl border border-gray-200 bg-white overflow-hidden";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div style={{
          width: 36, height: 36, border: '3px solid #e0deff',
          borderTopColor: '#534AB7', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!info || !data) {
    return <div className="text-center py-20 text-sm text-gray-400">Could not load referral data.</div>;
  }

  return (
    <div className="space-y-4 w-full">

      {/* Hero card */}
      <div className={cardCls}>
        <div className="px-5 py-6 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
          <h2 className="text-lg font-semibold mb-1">Refer & Earn</h2>
          <p className="text-sm text-white/80 mb-4">
            Share your link — you get <span className="font-bold">₹{info.rewards.referrerReward}</span> + <span className="font-bold">{info.rewards.commissionPercent}% lifetime commission</span>.
            Your friend gets <span className="font-bold">₹{info.rewards.referredReward}</span> bonus.
          </p>
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-white/60 mb-1">Your Referral Code</div>
              <div className="text-base font-mono font-bold tracking-wider truncate">{info.referralCode}</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={copyLink}
              className="flex-1 rounded-lg bg-white text-indigo-600 text-sm font-semibold px-4 py-2.5 hover:bg-white/90 transition"
            >
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={shareLink}
              className="flex-1 rounded-lg bg-white/10 border border-white/30 text-white text-sm font-semibold px-4 py-2.5 hover:bg-white/20 transition"
            >
              Share
            </button>
          </div>
          <div className="mt-3 text-[11px] text-white/60 font-mono break-all">{info.referralLink}</div>
        </div>
      </div>

      {/* How it works */}
      <div className={cardCls}>
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-800">How It Works</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {[
            { step: '1', text: 'Share your referral link with friends.' },
            { step: '2', text: 'They sign up using your link/code.' },
            { step: '3', text: `Reward stays locked until they complete ${info.rewards.unlockThreshold.toLocaleString()} clicks on their links.` },
            { step: '4', text: `Once unlocked: you get ₹${info.rewards.referrerReward} + ${info.rewards.commissionPercent}% of their future earnings, they get ₹${info.rewards.referredReward}.` },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center">{s.step}</div>
              <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${cardCls} px-4 py-4`}>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Total Referred</div>
          <div className="text-xl font-bold text-gray-800">{data.summary.totalReferred}</div>
        </div>
        <div className={`${cardCls} px-4 py-4`}>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Unlocked</div>
          <div className="text-xl font-bold text-emerald-600">{data.summary.unlockedCount}</div>
        </div>
        <div className={`${cardCls} px-4 py-4`}>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Pending</div>
          <div className="text-xl font-bold text-amber-500">{data.summary.pendingCount}</div>
        </div>
        <div className={`${cardCls} px-4 py-4`}>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Earned (Bonus)</div>
          <div className="text-xl font-bold text-indigo-600">₹{data.summary.totalEarnedFromReferrals}</div>
        </div>
      </div>

      {data.summary.estimatedCommissionEarnings > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
          💰 Estimated lifetime commission earned so far: <span className="font-bold">₹{data.summary.estimatedCommissionEarnings.toFixed(2)}</span> ({data.summary.commissionPercent}% of referred users' earnings)
        </div>
      )}

      {/* Referral list */}
      <div className={cardCls}>
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-800">Your Referrals</p>
        </div>
        {data.referrals.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No referrals yet. Share your link to start earning!
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.referrals.map(r => (
              <div key={r._id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{r.referredRealName}</div>
                    <div className="text-xs text-gray-400 font-mono">@{r.referredUsername}</div>
                  </div>
                  <div>
                    {r.status === 'unlocked' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium">
                        ✓ Unlocked &bull; ₹{r.referrerReward}
                      </span>
                    ) : r.status === 'flagged' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-500 text-xs font-medium">
                        Under Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-xs font-medium">
                        Locked
                      </span>
                    )}
                  </div>
                </div>

                {r.status !== 'unlocked' && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                      <span>{r.currentClicks.toLocaleString()} / {r.unlockThreshold.toLocaleString()} clicks</span>
                      <span>{r.clicksRemaining.toLocaleString()} clicks remaining</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all"
                        style={{ width: `${r.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {r.status === 'unlocked' && r.unlockedAt && (
                  <div className="text-[11px] text-gray-400">
                    Unlocked on {new Date(r.unlockedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}

                <div className="text-[11px] text-gray-400 mt-1">
                  Joined {new Date(r.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralTab;
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
    actualCommissionCredited: number;
    commissionPercent: number;
    flaggedCount: number;
  };
  referrals: ReferralItem[];
}

const ReferralTab: React.FC<{ token: string; onToast: (text: string, type?: 'success' | 'error') => void }> = ({ token, onToast }) => {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // ── Referral code validate on blur ──
  const [validateCode, setValidateCode] = useState('');
  const [validateStatus, setValidateStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [validateName, setValidateName] = useState('');

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

  // ── Native share ──
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

  // ── WhatsApp share ──
  const shareWhatsApp = () => {
    if (!info) return;
    const msg = encodeURIComponent(
      `*AnimaBing - Earn Money Online*\n\n` +
      `I would like to invite you to join AnimaBing, a platform where you can earn real money by sharing links.\n\n` +
      `Sign up using my referral link and receive a *Rs.${info.rewards.referredReward} welcome bonus* upon joining.\n\n` +
      `Referral Link: ${info.referralLink}\n` +
      `Referral Code: *${info.referralCode}*\n\n` +
      `Once you complete ${info.rewards.unlockThreshold.toLocaleString()} clicks on your links, the reward will be unlocked automatically.\n\n` +
      `Join now and start earning.`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  // ── Validate referral code on blur ──
  const handleValidateBlur = async () => {
    const code = validateCode.trim().toUpperCase();
    if (!code) { setValidateStatus('idle'); return; }
    setValidateStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/referral/validate/${code}`);
      const json = await res.json();
      if (json.valid) {
        setValidateStatus('valid');
        setValidateName(json.referrerName || '');
      } else {
        setValidateStatus('invalid');
        setValidateName('');
      }
    } catch {
      setValidateStatus('invalid');
      setValidateName('');
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

      {/* ── Hero card ── */}
      <div className={cardCls}>
        <div className="px-5 py-6 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
          <h2 className="text-lg font-semibold mb-1">Refer & Earn</h2>
          <p className="text-sm text-white/80 mb-4">
            Share your link — you get <span className="font-bold">₹{info.rewards.referrerReward}</span> + <span className="font-bold">{info.rewards.commissionPercent}% lifetime commission</span>.
            Your friend gets <span className="font-bold">₹{info.rewards.referredReward}</span> bonus.
          </p>

          {/* Referral code box */}
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-white/60 mb-1">Your Referral Code</div>
              <div className="text-base font-mono font-bold tracking-wider truncate">{info.referralCode}</div>
            </div>
          </div>

          {/* Buttons row */}
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

          {/* WhatsApp share button */}
          <button
            onClick={shareWhatsApp}
            style={{ background: '#25D366' }}
            className="w-full mt-2 rounded-lg text-white text-sm font-semibold px-4 py-2.5 hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Share on WhatsApp
          </button>

          <div className="mt-3 text-[11px] text-white/60 font-mono break-all">{info.referralLink}</div>
        </div>
      </div>

      {/* ── Validate a referral code ── */}
      <div className={cardCls}>
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-800">Check a Referral Code</p>
          <p className="text-xs text-gray-400 mt-0.5">Kisi ka code valid hai ya nahi check karo</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Enter referral code (e.g. ABCD1234)"
                value={validateCode}
                onChange={e => {
                  setValidateCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  setValidateStatus('idle');
                  setValidateName('');
                }}
                onBlur={handleValidateBlur}
                maxLength={12}
                style={{
                  width: '100%', padding: '10px 40px 10px 14px',
                  border: `1.5px solid ${validateStatus === 'valid' ? '#22c55e' : validateStatus === 'invalid' ? '#ef4444' : '#e2e2f0'}`,
                  borderRadius: 10, fontSize: 14, outline: 'none',
                  fontFamily: 'monospace', letterSpacing: '0.05em',
                  background: validateStatus === 'valid' ? '#f0fdf4' : validateStatus === 'invalid' ? '#fff5f5' : '#f8f8fc',
                  color: '#1a1a2e', transition: 'border-color 0.2s',
                }}
              />
              {/* Status icon inside input */}
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                {validateStatus === 'loading' && (
                  <div style={{ width: 16, height: 16, border: '2px solid #e0deff', borderTopColor: '#534AB7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                )}
                {validateStatus === 'valid' && <span style={{ color: '#22c55e', fontSize: 18 }}>✓</span>}
                {validateStatus === 'invalid' && <span style={{ color: '#ef4444', fontSize: 18 }}>✗</span>}
              </div>
            </div>
            <button
              onClick={handleValidateBlur}
              style={{
                padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'linear-gradient(135deg,#534AB7,#7c72d8)', color: 'white',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Check
            </button>
          </div>
          {/* Validate result message */}
          {validateStatus === 'valid' && validateName && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <span style={{ color: '#15803d', fontSize: 13 }}>✓ Valid code! Referrer: <strong>{validateName}</strong></span>
            </div>
          )}
          {validateStatus === 'invalid' && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8 }}>
              <span style={{ color: '#b91c1c', fontSize: 13 }}>✗ Invalid or inactive referral code</span>
            </div>
          )}
        </div>
      </div>

      {/* ── How it works ── */}
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

      {/* ── Summary stats ── */}
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

      {/* Flagged warning */}
      {(data.summary.flaggedCount ?? 0) > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          ⚠️ <strong>{data.summary.flaggedCount}</strong> referral(s) under review. Admin se contact karo agar issue ho.
        </div>
      )}

      {/* Commission earnings */}
      {data.summary.estimatedCommissionEarnings > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700 space-y-1">
          <div>💰 Estimated lifetime commission: <span className="font-bold">₹{data.summary.estimatedCommissionEarnings.toFixed(2)}</span> ({data.summary.commissionPercent}% of referred users' earnings)</div>
          {(data.summary.actualCommissionCredited ?? 0) > 0 && (
            <div>✅ Actually credited: <span className="font-bold">₹{data.summary.actualCommissionCredited.toFixed(2)}</span></div>
          )}
        </div>
      )}

      {/* ── Referral list ── */}
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
                        ⚠ Under Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-xs font-medium">
                        🔒 Locked
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
                    <div className="text-[10px] text-gray-400 mt-1 text-right">{r.progressPercent}% complete</div>
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

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default ReferralTab;
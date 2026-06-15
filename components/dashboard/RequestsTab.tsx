 import React, { useState } from 'react';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users';

interface DashboardData {
  user: { totalClicks: number; unpaidEarnings: number };
  pendingPaymentRequest: boolean;
  pendingLinkRequest: boolean;
}

const RequestsTab: React.FC<{ data: DashboardData; onRefresh: () => void; token: string; onToast: any }> = ({
  data,
  onRefresh,
  token,
  onToast,
}) => {
  const [linkMsg, setLinkMsg] = useState('');
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);

  const canPayRequest = (data.user.totalClicks || 0) >= 1000 && (data.user.unpaidEarnings || 0) > 0;
  const progressPct = Math.min(((data.user.totalClicks || 0) / 1000) * 100, 100);

  const requestPayment = async () => {
    setLoadingPayment(true);
    try {
      const res = await fetch(`${API_BASE}/request/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) { onToast(d.error || 'Request failed', 'error'); return; }
      onToast(d.message || 'Payment request sent!', 'success');
      onRefresh();
    } catch {
      onToast('Network error', 'error');
    } finally {
      setLoadingPayment(false);
    }
  };

  const requestLink = async () => {
    if (!linkMsg.trim()) { onToast('Please add a message for the admin.', 'error'); return; }
    setLoadingLink(true);
    try {
      const res = await fetch(`${API_BASE}/request/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: linkMsg }),
      });
      const d = await res.json();
      if (!res.ok) { onToast(d.error || 'Request failed', 'error'); return; }
      onToast(d.message || 'Link request sent!', 'success');
      setLinkMsg('');
      onRefresh();
    } catch {
      onToast('Network error', 'error');
    } finally {
      setLoadingLink(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* ── Payment Request Card ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* Header strip */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Payment Request</p>
            <p className="text-xs text-gray-400">Withdraw your earned balance</p>
          </div>
        </div>

        <div className="px-5 py-4">
          {data.pendingPaymentRequest ? (
            /* Pending state */
            <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-amber-800">Request under review</p>
                <p className="text-xs text-amber-600 mt-0.5">You'll be notified once processed</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                Pending
              </span>
            </div>
          ) : canPayRequest ? (
            /* Eligible state */
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
                <div>
                  <p className="text-xs text-emerald-600 uppercase tracking-wider font-medium">Available to withdraw</p>
                  <p className="text-2xl font-semibold text-emerald-700 mt-0.5">
                    ₹{data.user.unpaidEarnings.toFixed(2)}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <button
                onClick={requestPayment}
                disabled={loadingPayment}
                className="w-full sm:w-auto rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
              >
                {loadingPayment ? 'Sending…' : 'Request Payment'}
              </button>
            </div>
          ) : (
            /* Not eligible state */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Progress to payout</span>
                <span className="font-medium text-gray-700">
                  {(data.user.totalClicks || 0).toLocaleString()} / 1,000 clicks
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {Math.max(0, 1000 - (data.user.totalClicks || 0))} more clicks needed to unlock payment
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Link Request Card ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* Header strip */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Request a Link</p>
            <p className="text-xs text-gray-400">Ask admin to create a new short link</p>
          </div>
        </div>

        <div className="px-5 py-4">
          {data.pendingLinkRequest ? (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-amber-800">Link request pending</p>
                <p className="text-xs text-amber-600 mt-0.5">Admin will review and create your link shortly</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                Pending
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Describe which link you need — anime title, episode range, or any relevant details.
              </p>
              <textarea
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none h-28 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                placeholder="e.g. I want death noth custom link"
                value={linkMsg}
                onChange={e => setLinkMsg(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{linkMsg.length} characters</span>
                <button
                  onClick={requestLink}
                  disabled={loadingLink || !linkMsg.trim()}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loadingLink ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default RequestsTab;
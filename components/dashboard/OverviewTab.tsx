 import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip as ChartTooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, ChartTooltip);

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users';

interface DashboardData {
  user: {
    username: string;
    realName: string;
    totalClicks: number;
    todayClicks: number;
    totalEarnings: number;
    unpaidEarnings: number;
    paidEarnings: number;
    ratePerThousand: number;
    profile: any;
    gmailLinked?: string;
    canCreateLinks?: boolean;
    avatarId?: number | null;
  };
  links: Array<{ code: string; label?: string; clicks: number; lastClicked: string | null }>;
  last7Days: Array<{ date: string; clicks: number }>;
  topCountries: Array<{ _id: string; count: number }>;
  unreadMessages: number;
  pendingPaymentRequest: boolean;
  pendingLinkRequest: boolean;
}

// ─── Professional Line Chart (Chart.js) ───────────────────────────────────

const ClicksLineChart: React.FC<{ data: Array<{ date: string; clicks: number }> }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(99,102,241,0.25)');
    grad.addColorStop(0.7, 'rgba(99,102,241,0.05)');
    grad.addColorStop(1, 'rgba(99,102,241,0.00)');

    chartRef.current = new ChartJS(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.date),
        datasets: [
          {
            data: data.map(d => d.clicks),
            borderColor: '#6366f1',
            borderWidth: 2.5,
            backgroundColor: grad,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#6366f1',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#6366f1',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeInOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2937',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            titleColor: '#9ca3af',
            bodyColor: '#ffffff',
            titleFont: { size: 11 },
            bodyFont: { size: 13, weight: 'bold' as const },
            padding: 10,
            cornerRadius: 6,
            displayColors: false,
            callbacks: {
              title: (items) => items[0]?.label ?? '',
              label: (item) => `${Number(item.raw).toLocaleString()} clicks`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: '#9ca3af',
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: true,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.04)' },
            border: { display: false },
            ticks: {
              color: '#9ca3af',
              font: { size: 11 },
              maxTicksLimit: 5,
              precision: 0,
              callback: (v) =>
                Number(v) >= 1000 ? (Number(v) / 1000).toFixed(1) + 'k' : v,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        No click data yet
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '200px' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '200px' }} />
    </div>
  );
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ data: DashboardData; onRefresh: () => void; onToast: any }> = ({
  data,
  onRefresh,
  onToast,
}) => {
  const { user, last7Days, topCountries } = data;
  const canPayRequest = (user.totalClicks || 0) >= 1000 && (user.unpaidEarnings || 0) > 0;
  const progressPct = Math.min(((user.totalClicks || 0) / 1000) * 100, 100);
  const maxCountry = topCountries.length ? Math.max(...topCountries.map(c => c.count)) : 1;

  const requestPayment = async () => {
    try {
      const res = await fetch(`${API_BASE}/request/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('shortUserToken')}` },
      });
      const d = await res.json();
      if (!res.ok) { onToast(d.error || 'Request failed', 'error'); return; }
      onToast(d.message || 'Payment request sent!', 'success');
      onRefresh();
    } catch {
      onToast('Network error', 'error');
    }
  };

  return (
    <div className="space-y-4">

      {/* ── Banner ── */}
      {canPayRequest && !data.pendingPaymentRequest && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-800">Payment available</p>
            <p className="text-sm text-emerald-700 mt-0.5">
              ₹{user.unpaidEarnings.toFixed(2)} is ready to request
            </p>
            <p className="text-xs text-emerald-600 mt-1.5">Min 1,000 clicks · Max 1,00,000 clicks</p>
          </div>
          <button
            onClick={requestPayment}
            className="shrink-0 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Request Payment
          </button>
        </div>
      )}

      {data.pendingPaymentRequest && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">Payment request pending</p>
            <p className="text-sm text-amber-700 mt-0.5">Under review — we'll notify you once processed</p>
            <p className="text-xs text-amber-600 mt-1.5">Min 1,000 clicks · Max 1,00,000 clicks</p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            Pending
          </span>
        </div>
      )}

      {!canPayRequest && !data.pendingPaymentRequest && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-indigo-800">Keep growing</p>
            <span className="text-xs font-medium text-indigo-600">
              {user.totalClicks || 0} / 1,000
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-indigo-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-indigo-600 mt-2">
            {Math.max(0, 1000 - (user.totalClicks || 0))} more clicks needed · Min 1,000 · Max 1,00,000
          </p>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Clicks',
            value: (user.totalClicks || 0).toLocaleString(),
            sub: 'All links combined',
            color: 'text-indigo-600',
          },
          {
            label: "Today's Clicks",
            value: (user.todayClicks || 0).toLocaleString(),
            sub: 'Last 24 hours',
            color: 'text-emerald-600',
          },
          {
            label: 'Total Earned',
            value: `₹${user.totalEarnings.toFixed(2)}`,
            sub: `₹${user.ratePerThousand} / 1000`,
            color: 'text-amber-600',
          },
          {
            label: 'Pending',
            value: `₹${user.unpaidEarnings.toFixed(2)}`,
            sub: `Paid: ₹${user.paidEarnings.toFixed(2)}`,
            color: 'text-rose-500',
          },
        ].map(({ label, value, sub, color }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors"
          >
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">{label}</p>
            <p className={`text-2xl font-semibold leading-none ${color}`}>{value}</p>
            <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Clicks Chart ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Last 7 days</p>
          <button
            onClick={onRefresh}
            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            Refresh
          </button>
        </div>
        <ClicksLineChart data={last7Days} />
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Top Countries */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Top Countries</p>
          {topCountries.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topCountries.map(c => (
                <div key={c._id} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm text-gray-600 truncate">{c._id}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-400"
                      style={{ width: `${(c.count / maxCountry) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs font-medium text-indigo-500 shrink-0">
                    {c.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Earning Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Earning Details</p>
          <div className="divide-y divide-gray-100 text-sm">
            {[
              { label: 'Rate / 1000 clicks', value: `₹${user.ratePerThousand}` },
              { label: 'Rate / click', value: `₹${(user.ratePerThousand / 1000).toFixed(4)}` },
              { label: 'Total earned', value: `₹${user.totalEarnings.toFixed(2)}` },
              { label: 'Already paid', value: `₹${user.paidEarnings.toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2.5">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
            <div className="flex justify-between py-2.5">
              <span className="text-amber-600">Pending payment</span>
              <span className="font-semibold text-amber-600">₹{user.unpaidEarnings.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-gray-300 pb-2">AnimaBing © 2026</p>
    </div>
  );
};

export default OverviewTab;
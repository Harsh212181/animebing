 import React, { useState } from 'react';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users';

const AVATARS = [
  { id: 1,  emoji: '🦊', bg: 'linear-gradient(135deg,#f97316,#ef4444)' },
  { id: 2,  emoji: '🐉', bg: 'linear-gradient(135deg,#a855f7,#6366f1)' },
  { id: 3,  emoji: '⚡', bg: 'linear-gradient(135deg,#eab308,#f97316)' },
  { id: 4,  emoji: '👻', bg: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
  { id: 5,  emoji: '🗡️', bg: 'linear-gradient(135deg,#64748b,#334155)' },
  { id: 6,  emoji: '🌙', bg: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
  { id: 7,  emoji: '🔥', bg: 'linear-gradient(135deg,#ef4444,#f97316)' },
  { id: 8,  emoji: '🦚', bg: 'linear-gradient(135deg,#38bdf8,#06b6d4)' },
  { id: 9,  emoji: '🧌', bg: 'linear-gradient(135deg,#0ea5e9,#3b82f6)' },
  { id: 10, emoji: '🦋', bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)' },
  { id: 11, emoji: '🎮', bg: 'linear-gradient(135deg,#6366f1,#4f46e5)' },
  { id: 12, emoji: '🧙‍♂️', bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)' },
  { id: 13, emoji: '🐺', bg: 'linear-gradient(135deg,#78716c,#57534e)' },
  { id: 14, emoji: '⚖️', bg: 'linear-gradient(135deg,#22c55e,#16a34a)' },
  { id: 15, emoji: '💀', bg: 'linear-gradient(135deg,#374151,#111827)' },
  { id: 16, emoji: '🦅', bg: 'linear-gradient(135deg,#0369a1,#1d4ed8)' },
  { id: 17, emoji: '🛸', bg: 'linear-gradient(135deg,#f43f5e,#e11d48)' },
  { id: 18, emoji: '⛈️', bg: 'linear-gradient(135deg,#475569,#1e293b)' },
  { id: 19, emoji: '🐉', bg: 'linear-gradient(135deg,#10b981,#059669)' },
  { id: 20, emoji: '💎', bg: 'linear-gradient(135deg,#06b6d4,#0891b2)' },
  { id: 21, emoji: '🌪️', bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
  { id: 22, emoji: '🏔️', bg: 'linear-gradient(135deg,#64748b,#475569)' },
  { id: 23, emoji: '🦁', bg: 'linear-gradient(135deg,#d97706,#92400e)' },
  { id: 24, emoji: '🌌', bg: 'linear-gradient(135deg,#1e1b4b,#312e81)' },
  { id: 25, emoji: '🎙️', bg: 'linear-gradient(135deg,#be185d,#9d174d)' },
];

// ─── SVG Icons ─────────────────────────────────────────────────────────────────
const Icon = {
  phone: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  mail: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  card: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  upiPhone: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  user: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  gender: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="4"/><path strokeLinecap="round" strokeLinejoin="round" d="M11 7V3m0 0h3M11 3H8m8.657 5.343L21 4m0 0h-4m4 0v4"/>
    </svg>
  ),
  edit: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.943l-3.414.857.857-3.414a4 4 0 01.943-1.414z" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  gmail: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ─── Avatar Display ────────────────────────────────────────────────────────────
const AvatarDisplay: React.FC<{ avatarId: number | null; name: string; size?: number }> = ({
  avatarId, name, size = 36,
}) => {
  const av = AVATARS.find(a => a.id === avatarId);
  const radius = Math.round(size * 0.24);
  const fontSize = size * 0.46;

  if (av) {
    return (
      <div style={{ width: size, height: size, background: av.bg, borderRadius: radius, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, flexShrink: 0 }}>
        {av.emoji}
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', borderRadius: radius, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: 'white', flexShrink: 0, letterSpacing: '-0.5px' }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

// ─── Section Label ─────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-3">{children}</p>
);

// ─── Field ─────────────────────────────────────────────────────────────────────
const Field: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  label, icon, children,
}) => (
  <div>
    <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">
      <span className="text-gray-400">{icon}</span>
      {label}
    </label>
    {children}
  </div>
);

// ─── Profile Tab ───────────────────────────────────────────────────────────────
const ProfileTab: React.FC<{
  user: any;
  onProfileUpdate: () => void;
  token: string;
  onToast: any;
  avatarId: number | null;
  name: string;
  onOpenAvatarPicker: () => void;
}> = ({ user, onProfileUpdate, token, onToast, avatarId, name, onOpenAvatarPicker }) => {
  const [form, setForm] = useState({
    mobile:   user.profile?.mobile   || '',
    gmail:    user.profile?.gmail    || '',
    upiId:    user.profile?.upiId    || '',
    upiPhone: user.profile?.upiPhone || '',
    age:      user.profile?.age      || '',
    gender:   user.profile?.gender   || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mobile:   form.mobile,
          gmail:    form.gmail.toLowerCase(),
          upiId:    form.upiId,
          upiPhone: form.upiPhone,
          age:      form.age ? parseInt(form.age as string) : null,
          gender:   form.gender,
        }),
      });
      const data = await res.json();
      if (!res.ok) onToast(data.error || 'Save failed', 'error');
      else { onToast('Profile saved successfully.', 'success'); onProfileUpdate(); }
    } catch { onToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const inputCls = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition";
  const selectCls = `${inputCls} cursor-pointer`;

  return (
    <div className="space-y-4 w-full">

      {/* ── Profile Header Card ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* Dark top band */}
        <div className="px-5 py-5 bg-gray-900">
          <div className="flex items-center gap-4">
            <div className="relative">
              <AvatarDisplay avatarId={avatarId} name={name} size={64} />
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-gray-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-white truncate">{name}</p>
              <p className="text-sm text-gray-400">@{user.username}</p>
            </div>
            <button
              onClick={onOpenAvatarPicker}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-medium text-white transition-colors"
            >
              <span className="text-white/70">{Icon.edit}</span>
              Change Avatar
            </button>
          </div>
        </div>

        {/* Gmail linked banner */}
        {user.gmailLinked && (
          <div className="flex items-center gap-2.5 px-5 py-3 border-t border-gray-100 bg-emerald-50">
            <span className="text-emerald-500">{Icon.gmail}</span>
            <p className="text-sm text-emerald-700">
              <span className="font-medium">Gmail linked:</span>{' '}
              <span className="text-emerald-600">{user.gmailLinked}</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Form Card ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">

        {/* Card header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            {Icon.user}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Personal Information</p>
            <p className="text-xs text-gray-400">Used for payment and account recovery</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-6">

          {/* Contact */}
          <div>
            <SectionLabel>Contact Details</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Mobile" icon={Icon.phone}>
                <input type="tel" placeholder="9876543210" value={form.mobile} onChange={set('mobile')} className={inputCls} />
              </Field>
              <Field label="Gmail" icon={Icon.mail}>
                <input type="email" placeholder="you@gmail.com" value={form.gmail} onChange={set('gmail')} className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-100" />

          {/* Payment */}
          <div>
            <SectionLabel>Payment Details</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="UPI ID" icon={Icon.card}>
                <input type="text" placeholder="name@upi" value={form.upiId} onChange={set('upiId')} className={inputCls} />
              </Field>
              <Field label="UPI Phone" icon={Icon.upiPhone}>
                <input type="tel" placeholder="9876543210" value={form.upiPhone} onChange={set('upiPhone')} className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-100" />

          {/* About */}
          <div>
            <SectionLabel>About You</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Age" icon={Icon.user}>
                <input
                  type="number"
                  placeholder="22"
                  value={form.age}
                  onChange={set('age')}
                  className={inputCls}
                  style={{ MozAppearance: 'textfield' } as any}
                />
              </Field>
              <Field label="Gender" icon={Icon.gender}>
                <select value={form.gender} onChange={set('gender')} className={selectCls}>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Submit row */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-gray-400">Changes save to your account immediately.</p>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <span>{Icon.check}</span>
                  Save Profile
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>

    </div>
  );
};

export default ProfileTab;
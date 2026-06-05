 import React, { useState } from 'react';

interface LinkItem {
  code: string;
  label?: string;
  clicks: number;
  lastClicked: string | null;
  createdAt?: string | null;
}

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const ChevronUp = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 15l-6-6-6 6" />
  </svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);

const ClickBadge: React.FC<{ clicks: number }> = ({ clicks }) => {
  const tier = clicks > 100
    ? { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' }
    : clicks > 10
    ? { bg: '#fffbeb', color: '#92400e', border: '#fde68a' }
    : { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
  return (
    <span style={{ background: tier.bg, color: tier.color, border: `1.5px solid ${tier.border}`, borderRadius: 20, padding: '2px 11px', fontSize: 13, fontWeight: 700, lineHeight: 1.6, flexShrink: 0 }}>
      {clicks.toLocaleString()}
    </span>
  );
};

const CopyButton: React.FC<{ onCopy: () => void }> = ({ onCopy }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { onCopy(); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .2s', fontFamily: 'inherit', letterSpacing: '.03em', background: copied ? '#f0fdf4' : '#f1f5f9', border: `1.5px solid ${copied ? '#bbf7d0' : '#e2e8f0'}`, color: copied ? '#166534' : '#475569' }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

const ExpandPanel: React.FC<{ link: LinkItem }> = ({ link }) => {
  const tier = link.clicks > 100
    ? { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' }
    : link.clicks > 10
    ? { bg: '#fffbeb', color: '#92400e', border: '#fde68a' }
    : { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
  return (
    <div style={{ padding: '0 20px 14px 64px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ height: 1, background: '#f1f5f9', marginBottom: 2 }} />
      {[
        { label: 'Link', content: <span style={{ fontFamily: "'Courier New',monospace", fontSize: 12, color: '#4f46e5', fontWeight: 600, wordBreak: 'break-all' as const }}>go.animebing.in/{link.code}</span> },
        { label: 'Label', content: <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{link.label || '—'}</span> },
        { label: 'Clicks', content: <span style={{ background: tier.bg, color: tier.color, border: `1.5px solid ${tier.border}`, borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>{link.clicks.toLocaleString()}</span> },
        { label: 'Last', content: <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}</span> },
      ].map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#94a3b8', minWidth: 54, paddingTop: 1 }}>{row.label}</span>
          {row.content}
        </div>
      ))}
    </div>
  );
};

const LinksTab: React.FC<{ links: LinkItem[]; onToast: any }> = ({ links, onToast }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'clicks' | 'recent' | 'az'>('clicks');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (code: string) => setExpanded(prev => {
    const s = new Set(prev); s.has(code) ? s.delete(code) : s.add(code); return s;
  });

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`https://go.animebing.in/${code}`);
    onToast('Link copied to clipboard', 'success');
  };

  const validLinks = links.filter(l => l && l.code);

  const filtered = validLinks
    .filter(l => !search || l.code.toLowerCase().includes(search.toLowerCase()) || (l.label || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'clicks') return b.clicks - a.clicks;

      if (sortBy === 'recent') {
        // createdAt available hai to use karo, warna lastClicked
        const getTime = (link: LinkItem): number => {
          const dateStr = link.createdAt || link.lastClicked;
          if (!dateStr) return Infinity; // null = abhi banaya (sabse upar)
          return new Date(dateStr).getTime();
        };
        const tA = getTime(a);
        const tB = getTime(b);
        // Infinity wale (null) sabse recent mane jayenge — upar aayenge
        if (tA === Infinity && tB === Infinity) return 0;
        if (tA === Infinity) return -1;
        if (tB === Infinity) return 1;
        return tB - tA; // naya pehle
      }

      return a.code.localeCompare(b.code);
    });

  const totalClicks = validLinks.reduce((s, l) => s + (l.clicks || 0), 0);

  return (
    <div style={{ width: '100%', fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <style>{`
        .exp-btn { display: none !important; }
        @media (max-width: 540px) {
          .exp-btn { display: flex !important; }
          .lbl-col { display: none !important; }
          .date-col { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>My Short Links</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>{validLinks.length} link{validLinks.length !== 1 ? 's' : ''} · {totalClicks.toLocaleString()} total clicks</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Total',  value: validLinks.length,                            color: '#6366f1', bg: '#eef2ff' },
            { label: 'Clicks', value: totalClicks,                                  color: '#0891b2', bg: '#ecfeff' },
            { label: 'Active', value: validLinks.filter(l => l.clicks > 0).length,  color: '#059669', bg: '#f0fdf4' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '6px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: s.color, fontWeight: 600, opacity: .7 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', display: 'flex' }}><SearchIcon /></span>
          <input type="text" placeholder="Search links or labels…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '9px 14px 9px 34px', fontSize: 13, color: '#1e293b', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['clicks', 'Clicks'], ['recent', 'Recent'], ['az', 'A – Z']] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setSortBy(val)} style={{ padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit', border: `1.5px solid ${sortBy === val ? '#6366f1' : '#e2e8f0'}`, background: sortBy === val ? '#6366f1' : '#f1f5f9', color: sortBy === val ? '#fff' : '#475569' }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Empty states */}
      {validLinks.length === 0 ? (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>No links yet</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Request a short link from the Requests tab.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>No links match "<strong>{search}</strong>"</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((link, idx) => {
            const isOpen = expanded.has(link.code);
            return (
              <div key={link.code} style={{ background: '#fff', border: `1.5px solid ${isOpen ? '#a5b4fc' : '#e2e8f0'}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.04)', transition: 'border-color .15s' }}>
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: idx < 3 ? '#eef2ff' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: idx < 3 ? '#6366f1' : '#94a3b8', flexShrink: 0 }}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Courier New',monospace", fontSize: 13, fontWeight: 600, color: '#4f46e5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>go.animebing.in/{link.code}</div>
                    {link.label && <div className="lbl-col" style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.label}</div>}
                  </div>
                  <ClickBadge clicks={link.clicks || 0} />
                  <div className="date-col" style={{ flexShrink: 0, minWidth: 80, textAlign: 'right', fontSize: 12, color: '#94a3b8' }}>
                    {link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'}
                  </div>
                  <CopyButton onCopy={() => copyLink(link.code)} />
                  <button className="exp-btn" onClick={() => toggle(link.code)} aria-label="Toggle details"
                    style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${isOpen ? '#6366f1' : '#e2e8f0'}`, background: isOpen ? '#6366f1' : '#f8fafc', color: isOpen ? '#fff' : '#6366f1', cursor: 'pointer', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isOpen ? <ChevronUp /> : <ChevronDown />}
                  </button>
                </div>
                {isOpen && <ExpandPanel link={link} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LinksTab;
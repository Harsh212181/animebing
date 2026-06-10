 import React, { useState } from 'react';

// ── SVG Icons (unchanged) ──
const Ic = {
  user: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  mail: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>
    </svg>
  ),
  phone: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.5a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.61a16 16 0 006.29 6.29l1.14-1.14a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  upi: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
    </svg>
  ),
  tag: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1" fill="currentColor"/>
    </svg>
  ),
  download: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  link: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
    </svg>
  ),
  share: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  rupee: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12M6 8h12M6 13l6 8 6-8M6 8a4 4 0 000 5h4"/>
    </svg>
  ),
  check: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  x: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  msg: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  shield: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  chevron: (open: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display: 'block' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
};

// ── Fixed ABMark (A logo) ──
const ABMark = ({ size = 36 }: { size?: number }) => (
  <div style={{
    width: size, height: size,
    background: 'linear-gradient(135deg,#534AB7,#7c72d8)',
    borderRadius: size * 0.26,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
      <path d="M4 20l8-16 8 16" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 11h10" stroke="white" strokeWidth={2.5} strokeLinecap="round"/>
    </svg>
  </div>
);

const SectionLabel = ({ children }: { children: string }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '0.08em', color: '#9999bb',
    marginBottom: 10, paddingLeft: 2,
  }}>{children}</div>
);

const InfoCard = ({ bg, borderColor, icon, children }: { bg: string; borderColor: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: bg, border: `1px solid ${borderColor}`,
    borderRadius: 10, padding: '10px 12px', marginTop: 12,
  }}>
    <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
    <span style={{ fontSize: 12, lineHeight: 1.65 }}>{children}</span>
  </div>
);

const StepRow = ({ num, color, children }: { num: number; color: string; children: string }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
    <div style={{
      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
      background: color, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, marginTop: 1,
    }}>{num}</div>
    <span style={{ fontSize: 13, color: '#1a1a2e', lineHeight: 1.55 }}>{children}</span>
  </div>
);

// ── Bullet point for plain list (no red circles) ──
const BulletRow = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
    <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: '#d97706', marginTop: 7 }} />
    <span style={{ fontSize: 13, color: '#1a1a2e', lineHeight: 1.55, flex: 1 }}>{children}</span>
  </div>
);

const GettingStartedTab: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What counts as an invalid click?',
      a: 'Invalid clicks include repeated clicks from the same user, bot traffic, automated traffic, VPN-generated spam traffic, or any activity that violates our promotion guidelines. Only genuine user traffic will be counted as valid.',
    },
    {
      q: 'How and when are payments made?',
      a: 'Payments are made through UPI. The minimum withdrawal amount is Rs.100, which is equivalent to 1,000 valid clicks. You can request payment once you have between 1,000 and 100,000 valid clicks.',
    },
    {
      q: 'Can you share payment proofs from other promoters?',
      a: 'We are currently building our promoter program, so we do not have payment proofs from other promoters to share at this stage. However, all valid earnings will be tracked and paid according to the stated payment structure.',
    },
    {
      q: 'Is there a promoter agreement or guidelines document?',
      a: 'We are currently working on a simple promoter agreement and guidelines document. Before you start, we will share the promotion rules and payment terms with you.',
    },
  ];

  return (
    <>
      {/* Responsive padding: remove side gaps on mobile */}
      <style>{`
        .getting-started-container {
          width: 100%;
          padding: 0 24px;
          box-sizing: border-box;
        }
        @media (max-width: 640px) {
          .getting-started-container {
            padding: 0 !important;
          }
        }
      `}</style>
      <div className="getting-started-container">

        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg,#534AB7 0%,#7c72d8 100%)',
          borderRadius: 20, padding: '24px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <ABMark size={52} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'white', letterSpacing: '-0.02em', marginBottom: 4 }}>
              AnimeBing Promoter Program
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.6 }}>
              Promote anime content, generate valid clicks, and earn money directly to your UPI account.
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '8px 16px',
              marginTop: 10,
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.15)', borderRadius: 20,
                padding: '5px 14px',
                fontSize: 12, fontWeight: 600, color: 'white',
              }}>
                <span style={{ color: 'white' }}>{Ic.rupee}</span>
                Rs.100 per 1,000 valid clicks
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.15)', borderRadius: 20,
                padding: '5px 14px',
                fontSize: 12, fontWeight: 600, color: 'white',
              }}>
                <span style={{ color: 'white' }}>{Ic.check}</span>
                Min. 1,000 clicks
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.15)', borderRadius: 20,
                padding: '5px 14px',
                fontSize: 12, fontWeight: 600, color: 'white',
              }}>
                <span style={{ color: 'white' }}>{Ic.shield}</span>
                Max. 100,000 clicks
              </div>
            </div>
          </div>
        </div>

        {/* Step 1 – Create Your Tracking Link */}
        <SectionLabel>Step 1 — Create Your Tracking Link</SectionLabel>
        <div style={card}>
          <div style={cardHeader('#059669', '#f0fdf4')}>
            <span style={iconBox('#059669', '#f0fdf4')}>{Ic.link}</span>
            <span style={cardTitle}>Generate your unique link</span>
          </div>
          <div style={cardBody}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                'Open the Create Link tab in the app.',
                'Search for any anime you want to promote.',
                'Click "Create Link" to generate your unique tracking link.',
                'Go to My Links and copy your generated link.',
              ].map((text, i) => <StepRow key={i} num={i + 1} color="#059669">{text}</StepRow>)}
            </div>
            <InfoCard bg="#f0fdf4" borderColor="#bbf7d0" icon={<span style={{ color: '#059669' }}>{Ic.link}</span>}>
              <span style={{ color: '#065f46' }}>
                You can create tracking links for multiple anime and monitor each one separately from <strong>My Links</strong>.
              </span>
            </InfoCard>
          </div>
        </div>

        {/* ── Step 2 – Share Your Link & Earn (bullets instead of numbered red circles) ── */}
        <div style={{ marginTop: 20 }}>
          <SectionLabel>Step 2 — Share Your Link & Earn</SectionLabel>
          <div style={card}>
            <div style={cardHeader('#d97706', '#fffbeb')}>
              <span style={iconBox('#d97706', '#fffbeb')}>{Ic.share}</span>
              <span style={cardTitle}>Promote on social media & get clicks</span>
            </div>
            <div style={cardBody}>
              <p style={pStyle}>
                Your earnings depend on <strong>valid clicks</strong> from real users. The more you promote, the more you earn. Here's how to bring traffic:
              </p>

              {/* Bullet list instead of StepRow */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                <BulletRow>
                  Share your short link in <strong>WhatsApp & Telegram groups</strong> that are related to anime. Join fan groups, discussion groups, and community chats.
                </BulletRow>
                <BulletRow>
                  Create a <strong>Telegram channel</strong> and regularly post your link along with anime updates, news, or episode screenshots. Build an audience that clicks daily.
                </BulletRow>
                <BulletRow>
                  Make <strong>short anime videos</strong> – Instagram Reels, YouTube Shorts, or TikTok clips. Put your link in the bio, description, or as a pinned comment.
                </BulletRow>
                <BulletRow>
                  Post <strong>daily on social media</strong> – Instagram, Facebook, X (Twitter), Reddit, and other platforms. Write interesting captions, polls, or start discussions and include your link.
                </BulletRow>
                <BulletRow>
                  Create <strong>anime episode reviews, character highlights, or top lists</strong>. Share them with your link – people love to click when the content is engaging.
                </BulletRow>
                <BulletRow>
                  Explore <strong>creative ways</strong> – collaborate with other anime pages, post in relevant subreddits, use trending hashtags, and find what gives you the most clicks.
                </BulletRow>
              </div>

              <p style={{ ...pStyle, fontWeight: 600 }}>Popular platforms to promote:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 7, marginBottom: 14 }}>
                {['Instagram', 'WhatsApp Groups', 'Telegram Groups', 'X (Twitter)', 'YouTube', 'Facebook', 'Reddit', 'Other Communities'].map(pl => (
                  <div key={pl} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: '#fffbeb', border: '1px solid #fde68a',
                    borderRadius: 9, padding: '8px 10px',
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#d97706', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#92400e' }}>{pl}</span>
                  </div>
                ))}
              </div>

              <InfoCard bg="#fffbeb" borderColor="#fde68a" icon={<span style={{ color: '#d97706' }}>{Ic.rupee}</span>}>
                <span style={{ color: '#92400e' }}>
                  <strong>Consistency is key.</strong> Post every day, find ways that work best for you, and always focus on <strong>real, genuine traffic</strong>. Only valid clicks are counted – no bots or spam.
                </span>
              </InfoCard>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div style={{ marginTop: 20 }}>
          <SectionLabel>Important Rules</SectionLabel>
          <div style={card}>
            <div style={cardHeader('#dc2626', '#fff5f5')}>
              <span style={iconBox('#dc2626', '#fff5f5')}>{Ic.shield}</span>
              <span style={cardTitle}>Read before you start</span>
            </div>
            <div style={cardBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {([
                  [true,  'Only genuine, valid traffic will be counted.'],
                  [false, 'Do not use bots, fake traffic, or spam methods.'],
                  [false, 'Do not send repeated clicks from the same device.'],
                  [true,  'Promote only through legitimate social media channels.'],
                  [true,  'Keep your UPI ID updated in your profile for timely payments.'],
                  [true,  'Use the Message section in the app for any questions or help.'],
                ] as [boolean, string][]).map(([ok, text], i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: ok ? '#f0fdf4' : '#fff5f5',
                    border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: 10, padding: '9px 12px',
                  }}>
                    <span style={{ ...checkBadge(ok ? '#059669' : '#dc2626'), marginTop: 1 }}>
                      {ok ? Ic.check : Ic.x}
                    </span>
                    <span style={{ fontSize: 13, color: ok ? '#065f46' : '#991b1b', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── REQUEST A LINK (moved before FAQ) ── */}
        <div style={{ marginTop: 24 }}>
          <SectionLabel>Request a Link</SectionLabel>
          <div style={card}>
            <div style={cardHeader('#8b5cf6', '#f5f3ff')}>
              <span style={iconBox('#8b5cf6', '#f5f3ff')}>{Ic.link}</span>
              <span style={cardTitle}>Ask admin to create a new short link</span>
            </div>
            <div style={cardBody}>
              <p style={pStyle}>
                Describe which link you need — anime title, episode range, or any relevant details.
              </p>
              <InfoCard bg="#f5f3ff" borderColor="#d4d0f0" icon={<span style={{ color: '#8b5cf6' }}>{Ic.msg}</span>}>
                <span style={{ color: '#3b2f5e' }}>
                  Use the <strong>Requests</strong> tab to send a link request. The admin will review it and assign a new short link for you.
                </span>
              </InfoCard>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginTop: 24 }}>
          <SectionLabel>Frequently Asked Questions</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} style={{
                  background: 'white', borderRadius: 14,
                  border: `1px solid ${isOpen ? '#534AB735' : '#ece9ff'}`,
                  overflow: 'hidden', transition: 'border-color 0.2s',
                }}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px',
                      background: isOpen ? '#f8f7ff' : 'white',
                      border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                      fontFamily: 'inherit', transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                      background: '#f0eeff', color: '#534AB7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                    }}>Q</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#1a1a2e', lineHeight: 1.4 }}>
                      {faq.q}
                    </span>
                    <span style={{ color: '#aaaacc', flexShrink: 0 }}>{Ic.chevron(isOpen)}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 16px 14px 54px' }}>
                      <div style={{ height: 1, background: '#f0eeff', marginBottom: 10 }} />
                      <p style={{ fontSize: 13, color: '#555577', lineHeight: 1.65, margin: 0 }}>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'white', borderRadius: 14, border: '1px solid #ece9ff',
          padding: '14px 16px', marginTop: 20,
        }}>
          <ABMark size={32} />
          <div>
            <div style={{ fontSize: 12, color: '#555577', lineHeight: 1.55 }}>
              Need help? Use the <strong style={{ color: '#534AB7' }}>Message</strong> tab to contact us anytime.
            </div>
            <div style={{ fontSize: 11, color: '#aaaacc', marginTop: 2 }}>AnimeBing Team</div>
          </div>
        </div>

      </div>
    </>
  );
};

// ── Styles ──
const card: React.CSSProperties = {
  background: 'white', borderRadius: 16,
  border: '1px solid #ece9ff', overflow: 'hidden',
  width: '100%',
};
const cardHeader = (accent: string, light: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '13px 16px', background: light,
  borderBottom: '1px solid #ece9ff',
});
const cardBody: React.CSSProperties = { padding: '14px 16px' };
const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#1a1a2e' };
const iconBox = (color: string, bg: string): React.CSSProperties => ({
  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
  background: bg, color: color,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: `1px solid ${color}20`,
});
const checkBadge = (color: string): React.CSSProperties => ({
  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
  background: color, color: 'white',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
const pStyle: React.CSSProperties = {
  fontSize: 13, color: '#555577', lineHeight: 1.6, margin: '0 0 12px',
};

export default GettingStartedTab;
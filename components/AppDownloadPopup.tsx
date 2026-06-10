 // components/AppDownloadPopup.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const TRACKING_URL = 'https://go.animebing.in/animebingapp';
const APK_URL = 'https://english.animebing.in/animebing.apk';

const AppDownloadPopup: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => setVisible(false);

  const handleDownload = () => {
    // Tracking — hidden img pixel, fetch se zyada reliable
    const img = new Image();
    img.src = TRACKING_URL + '?t=' + Date.now();

    // APK download — thoda delay do taaki tracking hit ho sake
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = APK_URL;
      a.download = 'animebing.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, 300);

    setVisible(false);
  };

  if (!visible) return null;

  return createPortal(
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        width: '100vw', height: '100vh',
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes ab-in {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ab-bar {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '340px',
          background: '#0f0720',
          borderRadius: '20px',
          overflow: 'hidden',
          border: '1px solid rgba(167,139,250,0.2)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(167,139,250,0.1)',
          animation: 'ab-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
          position: 'relative',
        }}
      >
        {/* Animated top bar */}
        <div style={{
          height: '3px',
          background: 'linear-gradient(90deg, #7c3aed, #a855f7, #ec4899, #a855f7, #7c3aed)',
          backgroundSize: '200% 100%',
          animation: 'ab-bar 2.5s linear infinite',
        }} />

        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '14px', right: '14px',
            width: '26px', height: '26px',
            borderRadius: '50%',
            border: '1px solid rgba(167,139,250,0.2)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(196,181,253,0.6)',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          ✕
        </button>

        {/* Body */}
        <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>

          {/* Title */}
          <div style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#f3e8ff',
            marginBottom: '8px',
            letterSpacing: '-0.3px',
          }}>
            Anime<span style={{
              background: 'linear-gradient(90deg,#c084fc,#e879f9)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Bing</span> App
          </div>

          {/* Subtitle */}
          <p style={{
            fontSize: '13px',
            color: 'rgba(196,181,253,0.55)',
            lineHeight: 1.6,
            margin: '0 0 22px',
          }}>
            Watch Hindi & English anime without interruptions.<br />
            Faster streaming, offline downloads, HD quality.
          </p>

          {/* Download button */}
          <button
            onClick={handleDownload}
            style={{
              width: '100%',
              padding: '14px 16px',
              border: 'none',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6d28d9, #9333ea)',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '9px',
              boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
              marginBottom: '10px',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d="M12 3v13M7 11l5 5 5-5" />
              <path d="M5 20h14" />
            </svg>
            Download Free App
          </button>

          <p style={{ fontSize: '11px', color: 'rgba(167,139,250,0.3)', margin: 0 }}>
            Free · Android · No account needed
          </p>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default AppDownloadPopup;
 // src/components/SpecialModeBanner.tsx
import React, { useEffect, useState } from 'react';
import { linkifyText } from './SpecialModeLinkify'; // 🆕 Import linkifyText

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev';

interface ActiveMode {
  name: string;
  bannerText: string;
  forceLink5Only: boolean;
  displayLocations: string[];
}

interface Props {
  // ✅ ye batata hai ki ye component kis page pe render ho raha hai
  location: 'home' | 'detail' | 'downloadLink';
  className?: string;
}

const SpecialModeBanner: React.FC<Props> = ({ location, className = '' }) => {
  const [modes, setModes] = useState<ActiveMode[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchActive = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/special-modes/active`);
        const data = await res.json();
        if (cancelled) return;
        const list: ActiveMode[] = data.modes || [];
        // ✅ sirf wahi modes rakho jinki displayLocations me ye page shamil hai
        setModes(list.filter(m => Array.isArray(m.displayLocations) && m.displayLocations.includes(location)));
      } catch {
        if (!cancelled) setModes([]);
      }
    };
    fetchActive();
    return () => { cancelled = true; };
  }, [location]);

  if (modes.length === 0) return null;

  // ✅ agar ek se zyada mode is page pe active hai, sab ek ke niche ek stack ho jaayenge
  return (
    <div className={className}>
      {modes.map((m, i) => (
        <div
          key={`${m.name}-${i}`}
          className={`transform hover:scale-[1.02] transition-transform duration-300 ${i > 0 ? 'mt-3' : ''}`}
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 p-1 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-300/20 via-transparent to-purple-300/20 animate-shimmer" />
            <div className="relative rounded-xl bg-gradient-to-br from-purple-900/90 to-purple-800/90 px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-sm border border-white/20">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-3xl sm:text-4xl animate-bounce">🎉</span>
                <div>
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-extrabold bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
                    {m.name}!
                  </h3>
                  <p className="text-xs sm:text-sm lg:text-base text-white">
                    {linkifyText(m.bannerText)} {/* 🆕 linkifyText use karo */}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SpecialModeBanner;
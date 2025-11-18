 // components/AdSlot.tsx - SIMPLE TEST VERSION
import React, { useState, useEffect } from 'react';

interface AdSlotProps {
  position: string;
  className?: string;
}

const AdSlot: React.FC<AdSlotProps> = ({ position, className = '' }) => {
  const [adContent, setAdContent] = useState<React.ReactNode>(null);

  useEffect(() => {
    const realAds: Record<string, React.ReactNode> = {
      header: (
        <a
          href="https://www.example.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block cursor-pointer hover:opacity-90 transition-opacity"
        >
          <img
            src="https://via.placeholder.com/728x90/8B5CF6/FFFFFF?text=Header+Ad+728x90+CLICK+ME"
            alt="Header Advertisement"
            className="w-full rounded-lg shadow-lg"
          />
        </a>
      ),
      sidebar: (
        <a
          href="https://www.example.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block cursor-pointer hover:opacity-90 transition-opacity"
        >
          <img
            src="https://via.placeholder.com/300x600/4c1d95/FFFFFF?text=Sidebar+Ad+300x600"
            alt="Sidebar Advertisement"
            className="w-full rounded-lg shadow-lg"
          />
        </a>
      ),
      in_content: (
        <div className="text-center">
          <a
            href="https://www.example.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block cursor-pointer hover:opacity-90 transition-opacity"
          >
            <img
              src="https://via.placeholder.com/300x250/7c3aed/FFFFFF?text=In-Content+Ad+300x250"
              alt="In-Content Advertisement"
              className="w-full rounded-lg shadow-lg mx-auto"
            />
          </a>
          <p className="text-xs text-slate-500 mt-2">Advertisement</p>
        </div>
      )
    };

    setAdContent(realAds[position] || (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
        <p className="text-slate-400 text-sm">📢 Ad - {position}</p>
      </div>
    ));
  }, [position]);

  return (
    <div className={`ad-slot ${className}`}>
      {adContent}
    </div>
  );
};

export default AdSlot;
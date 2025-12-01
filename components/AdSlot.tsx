 // components/AdSlot.tsx - COMPLETE FIXED VERSION
import React, { useEffect, useRef, useState } from 'react';

interface AdSlotProps {
  position: string;
  className?: string;
  adCode?: string;
  isActive?: boolean;
}

const AdSlot: React.FC<AdSlotProps> = ({ 
  position, 
  className = '', 
  adCode, 
  isActive = true 
}) => {
  const adRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAd = async () => {
      if (!adRef.current) return;

      // Clear previous content
      adRef.current.innerHTML = '';

      // If no ad code or inactive, show placeholder
      if (!adCode || !isActive) {
        adRef.current.innerHTML = `
          <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
            <div class="text-slate-400 text-sm mb-1">📢 Advertisement</div>
            <div class="text-slate-500 text-xs">
              ${position} Slot - ${!adCode ? 'No Ad Configured' : 'Inactive'}
            </div>
          </div>
        `;
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Create container for ad
        const container = document.createElement('div');
        container.id = `ad-container-${position}`;
        container.className = 'ad-container';
        
        // Parse and execute ad code
        const parser = new DOMParser();
        const doc = parser.parseFromString(adCode, 'text/html');
        
        // Append all elements except scripts
        Array.from(doc.body.children).forEach(element => {
          if (element.tagName !== 'SCRIPT') {
            container.appendChild(element.cloneNode(true));
          }
        });

        adRef.current.appendChild(container);

        // Execute scripts
        const scripts = doc.getElementsByTagName('script');
        Array.from(scripts).forEach(oldScript => {
          const newScript = document.createElement('script');
          
          // Copy attributes
          Array.from(oldScript.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
          });
          
          // Copy content
          if (oldScript.src) {
            newScript.src = oldScript.src;
            newScript.async = true;
          } else {
            newScript.textContent = oldScript.textContent;
          }
          
          document.head.appendChild(newScript);
        });

        console.log(`✅ Ad loaded for ${position}`);
      } catch (error) {
        console.error(`❌ Error loading ad for ${position}:`, error);
        adRef.current.innerHTML = `
          <div class="bg-red-900/20 border border-red-700 rounded-lg p-4 text-center">
            <div class="text-red-400 text-sm mb-1">⚠️ Ad Error</div>
            <div class="text-red-300 text-xs">Failed to load ad</div>
          </div>
        `;
      } finally {
        setLoading(false);
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(loadAd, 100);
  }, [adCode, isActive, position]);

  if (loading) {
    return (
      <div className={`ad-slot ${className}`}>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center animate-pulse">
          <div className="text-slate-400 text-sm mb-1">📢 Loading Advertisement</div>
          <div className="text-slate-500 text-xs">{position} Slot</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={adRef}
      className={`ad-slot ${className}`}
      data-position={position}
      data-ad-loaded="true"
    />
  );
};

export default AdSlot;

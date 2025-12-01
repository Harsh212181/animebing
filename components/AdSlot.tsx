 // components/AdSlot.tsx - FIXED VERSION FOR ADSTERRA
import React, { useEffect, useRef, useState } from 'react';

interface AdSlotProps {
  position: string;
  className?: string;
  adCode?: string;
  isActive?: boolean;
  onAdLoaded?: () => void;
  onAdError?: (error: string) => void;
}

const AdSlot: React.FC<AdSlotProps> = ({ 
  position, 
  className = '', 
  adCode, 
  isActive = true,
  onAdLoaded,
  onAdError
}) => {
  const adRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adRef.current) return;

    // Clear previous content
    adRef.current.innerHTML = '';
    setError(null);

    // If no ad code or inactive
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
      if (onAdLoaded) onAdLoaded();
      return;
    }

    setLoading(true);
    
    // Check if it's Adsterra code
    const isAdsterra = adCode.includes('highperformanceformat.com');
    
    if (isAdsterra) {
      // Special handling for Adsterra ads
      handleAdsterraAd();
    } else {
      // Handle other ads normally
      handleRegularAd();
    }
    
    function handleAdsterraAd() {
      try {
        console.log(`🎯 Loading Adsterra ad for ${position}`);
        
        // Extract the script src
        const srcMatch = adCode.match(/src="([^"]+)"/);
        const src = srcMatch ? srcMatch[1] : null;
        
        if (!src) {
          throw new Error('Could not extract Adsterra script source');
        }
        
        // Create iframe for Adsterra ads (to avoid document.write issues)
        const iframe = document.createElement('iframe');
        iframe.style.width = '728px';
        iframe.style.height = '90px';
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';
        iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-forms';
        
        // Generate unique ID for the ad
        const adId = `adsterra-${position}-${Date.now()}`;
        iframe.name = adId;
        iframe.title = `Advertisement - ${position}`;
        
        // Create iframe content with the ad code
        const iframeDoc = iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <base target="_top">
              <style>
                body { margin: 0; padding: 0; }
                .adsterra-container { 
                  display: flex; 
                  justify-content: center; 
                  align-items: center;
                  width: 100%;
                  height: 100%;
                }
              </style>
            </head>
            <body>
              <div class="adsterra-container" id="${adId}">
                <!-- Ad will be loaded here -->
              </div>
              ${adCode}
            </body>
            </html>
          `);
          iframeDoc.close();
        }
        
        adRef.current.appendChild(iframe);
        
        // Set timeout to check if ad loaded
        setTimeout(() => {
          setLoading(false);
          if (onAdLoaded) onAdLoaded();
          console.log(`✅ Adsterra iframe loaded for ${position}`);
        }, 2000);
        
      } catch (err: any) {
        console.error(`❌ Adsterra ad error for ${position}:`, err);
        setError(err.message || 'Failed to load Adsterra ad');
        setLoading(false);
        if (onAdError) onAdError(err.message || 'Failed to load Adsterra ad');
        showFallbackAd();
      }
    }
    
    function handleRegularAd() {
      try {
        console.log(`📢 Loading regular ad for ${position}`);
        
        // Create container for ad
        const container = document.createElement('div');
        container.id = `ad-container-${position}`;
        container.innerHTML = adCode;
        
        adRef.current.appendChild(container);
        
        // Execute scripts
        const scripts = container.getElementsByTagName('script');
        Array.from(scripts).forEach(oldScript => {
          const newScript = document.createElement('script');
          
          // Copy all attributes
          if (oldScript.attributes) {
            Array.from(oldScript.attributes).forEach(attr => {
              newScript.setAttribute(attr.name, attr.value);
            });
          }
          
          // Copy content
          if (oldScript.src) {
            newScript.src = oldScript.src;
            newScript.async = true;
          } else if (oldScript.textContent) {
            newScript.textContent = oldScript.textContent;
          }
          
          document.head.appendChild(newScript);
        });
        
        console.log(`✅ Regular ad loaded for ${position}`);
        setLoading(false);
        if (onAdLoaded) onAdLoaded();
        
      } catch (err: any) {
        console.error(`❌ Regular ad error for ${position}:`, err);
        setError(err.message || 'Failed to load ad');
        setLoading(false);
        if (onAdError) onAdError(err.message || 'Failed to load ad');
        showFallbackAd();
      }
    }
    
    function showFallbackAd() {
      if (adRef.current) {
        adRef.current.innerHTML = `
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 20px; 
                      text-align: center; 
                      border-radius: 10px;
                      max-width: 728px;
                      margin: 0 auto;
                      min-height: 90px;
                      display: flex;
                      flex-direction: column;
                      justify-content: center;
                      align-items: center;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px;">🎬 AnimeBing Advertisement</h3>
            <p style="margin: 0 0 15px 0; font-size: 14px;">728x90 Test Banner (${position})</p>
            <button onclick="alert('Test ad clicked!')" 
                    style="background: white; 
                           color: #667eea; 
                           border: none; 
                           padding: 8px 20px; 
                           border-radius: 5px; 
                           cursor: pointer; 
                           font-weight: bold;
                           font-size: 14px;">
              Click Here (Test)
            </button>
            <div style="margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.7);">
              Position: ${position} | Type: Banner | Status: Fallback
            </div>
          </div>
        `;
      }
    }
    
  }, [adCode, isActive, position, onAdLoaded, onAdError]);

  // Loading state
  if (loading) {
    return (
      <div className={`ad-slot ${className}`}>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="text-slate-400 text-sm mb-1">📢 Loading Advertisement</div>
            <div className="text-slate-500 text-xs mb-2">{position} Slot</div>
            <div className="inline-block w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`ad-slot ${className}`}>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
          <div className="text-slate-400 text-sm mb-1">⚠️ Ad Error</div>
          <div className="text-slate-500 text-xs mb-2">{position} Slot</div>
          <div className="text-red-400 text-xs mb-3">{error}</div>
          <button 
            onClick={() => {
              setLoading(true);
              setError(null);
              setTimeout(() => setLoading(false), 100);
            }}
            className="mt-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={adRef}
      className={`ad-slot ${className}`}
      data-position={position}
      style={{
        minHeight: '90px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        overflow: 'hidden'
      }}
    />
  );
};

export default AdSlot;

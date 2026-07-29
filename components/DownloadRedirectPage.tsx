 // components/DownloadRedirectPage.tsx - FIXED VERSION (with anime-specific link control)
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

interface LinkSettings {
  link1: boolean;
  link2: boolean;
  link3: boolean;
  link4: boolean;
  link5: boolean;
  _id?: string;
  lastUpdated?: string;
}

interface DownloadPageState {
  title: string;
  animeTitle: string;
  animeId?: string;
  contentType: 'episode' | 'chapter';
  contentNumber: number;
  downloadLinks: string[]; // ✅ Changed: Now expects array of strings, not objects
}

const DownloadRedirectPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { episodeId } = useParams();
  
  const [countdown, setCountdown] = useState(5);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Link settings state
  const [linkSettings, setLinkSettings] = useState<LinkSettings>({
    link1: true,
    link2: true,
    link3: true,
    link4: true,
    link5: true
  });
  const [activeLinks, setActiveLinks] = useState<string[]>([]);
  const [selectedLink, setSelectedLink] = useState<string>('');
  const [title, setTitle] = useState('Downloading...');
  
  // Get data from location state
  const state = location.state as DownloadPageState | null;
  const queryParams = new URLSearchParams(location.search);
  const fileId = queryParams.get('id');
  const fileName = queryParams.get('fileName') || 'video.mp4';

  // Check if mobile
  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', () => {
      setIsMobile(window.innerWidth <= 768);
    });
    return () => window.removeEventListener('resize', () => {});
  }, []);

  // ✅ FIXED: Fetch link settings and process links (with anime-specific control)
  useEffect(() => {
    const initializeDownload = async () => {
      try {
        console.log('🚀 Initializing download...');
        
        // 1. Get download links from different sources
        let rawLinks: string[] = [];
        let contentTitle = '';
        
        // Source 1: From location state
        if (state?.downloadLinks && Array.isArray(state.downloadLinks)) {
          console.log('📥 Using links from state:', state.downloadLinks);
          rawLinks = state.downloadLinks;
          contentTitle = state.title || `Episode ${state.contentNumber}`;
        }
        // Source 2: From episode API (if episodeId exists)
        else if (episodeId) {
          try {
            console.log('📡 Fetching episode data for ID:', episodeId);
            const response = await fetch(`/api/episodes/${episodeId}`);
            const data = await response.json();
            
            if (data && Array.isArray(data.downloadLinks)) {
              rawLinks = data.downloadLinks;
              contentTitle = data.title || `Episode ${data.episodeNumber || '1'}`;
              console.log('✅ Episode data fetched:', { rawLinks, contentTitle });
            }
          } catch (err) {
            console.error('❌ Error fetching episode:', err);
          }
        }
        // Source 3: Old single link format
        else if (fileId) {
          rawLinks = [`https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`];
          contentTitle = fileName;
        }
        
        setTitle(contentTitle);
        console.log('📊 Raw links found:', rawLinks.length);
        
        // 2. Fetch link settings (use anime-specific if animeId present)
        console.log('🔧 Fetching link settings...');
        let settings: LinkSettings;
        try {
          // ✅ Use anime-specific endpoint if animeId is available, else global
          const settingsUrl = state?.animeId
            ? `/api/anime-link-control/effective/${state.animeId}`
            : '/api/link-settings';
          const settingsResponse = await fetch(settingsUrl);
          if (!settingsResponse.ok) {
            throw new Error(`HTTP ${settingsResponse.status}`);
          }
          const raw = await settingsResponse.json();
          settings = raw.data || raw;
          console.log('✅ Settings fetched:', settings);
        } catch (err) {
          console.error('⚠️ Using default settings (API failed):', err);
          settings = {
            link1: true,
            link2: true,
            link3: true,
            link4: true,
            link5: true
          };
        }
        
        setLinkSettings(settings);
        
        // 3. Filter links based on settings
        console.log('🎯 Filtering active links...');
        const filteredLinks: string[] = [];
        
        for (let i = 0; i < rawLinks.length; i++) {
          const linkNum = i + 1;
          const linkKey = `link${linkNum}` as keyof LinkSettings;
          
          // Check if link is enabled and has a valid URL
          if (settings[linkKey] && rawLinks[i] && rawLinks[i].trim() !== '') {
            filteredLinks.push(rawLinks[i]);
            console.log(`✅ Link ${linkNum} is active:`, rawLinks[i].substring(0, 50) + '...');
          } else {
            console.log(`❌ Link ${linkNum} is inactive or empty`);
          }
        }
        
        console.log('📈 Active links after filtering:', filteredLinks.length);
        
        // 4. Handle no active links
        if (filteredLinks.length === 0) {
          const errorMsg = rawLinks.length === 0 
            ? 'No download links found for this content.'
            : `All ${rawLinks.length} download link(s) are currently disabled by admin.`;
          
          setError(errorMsg);
          setActiveLinks([]);
          return;
        }
        
        // 5. Randomly select a link
        const randomIndex = Math.floor(Math.random() * filteredLinks.length);
        const selected = filteredLinks[randomIndex];
        
        console.log(`🎲 Randomly selected link ${randomIndex + 1}/${filteredLinks.length}:`, selected.substring(0, 50) + '...');
        
        setActiveLinks(filteredLinks);
        setSelectedLink(selected);
        
        // 6. Start countdown for auto-download
        console.log('⏱️ Starting countdown...');
        const countdownInterval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              console.log('🚀 Auto-downloading selected link...');
              handleAutoDownload(selected);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        return () => clearInterval(countdownInterval);
        
      } catch (err: any) {
        console.error('💥 Fatal error in initializeDownload:', err);
        setError('Failed to initialize download. Please try again.');
      }
    };
    
    initializeDownload();
  }, [episodeId, state, fileId, fileName]);

  // ✅ Handle auto-download
  const handleAutoDownload = (url: string) => {
    if (!url || isDownloading) return;
    
    setIsDownloading(true);
    console.log('📥 Opening download URL:', url.substring(0, 50) + '...');
    
    // Open in new tab for better user experience
    const newWindow = window.open(url, '_blank');
    
    if (!newWindow) {
      console.warn('⚠️ Popup blocked! Opening in same tab...');
      window.location.href = url;
    }
    
    // Reset downloading state after delay
    setTimeout(() => {
      setIsDownloading(false);
      console.log('✅ Download initiated');
    }, 2000);
  };

  // ✅ Handle manual download
  const handleManualDownload = () => {
    if (!selectedLink || activeLinks.length === 0) {
      setError('No active download links available');
      return;
    }
    
    // If there are multiple links, pick a random one (different from current)
    let linkToUse = selectedLink;
    if (activeLinks.length > 1) {
      const currentIndex = activeLinks.indexOf(selectedLink);
      let newIndex;
      do {
        newIndex = Math.floor(Math.random() * activeLinks.length);
      } while (newIndex === currentIndex && activeLinks.length > 1);
      linkToUse = activeLinks[newIndex];
      setSelectedLink(linkToUse);
    }
    
    console.log('🔄 Manual download with link:', linkToUse.substring(0, 50) + '...');
    handleAutoDownload(linkToUse);
  };

  // ✅ Handle back navigation
  const handleBack = () => {
    if (state?.animeId) {
      navigate(`/detail/${state.animeId}`);
    } else if (state?.contentType === 'chapter') {
      navigate('/manga');
    } else {
      navigate(-1);
    }
  };

  // ✅ Get active link count
  const getActiveLinkCount = () => {
    let count = 0;
    if (linkSettings.link1) count++;
    if (linkSettings.link2) count++;
    if (linkSettings.link3) count++;
    if (linkSettings.link4) count++;
    if (linkSettings.link5) count++;
    return count;
  };

  // ✅ Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-700/50 rounded-2xl p-8 max-w-md w-full backdrop-blur-sm shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-red-600/20 to-red-700/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
              <span className="text-4xl text-red-400">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-red-300 mb-2">Download Unavailable</h1>
            <p className="text-red-200/80 text-sm">{error}</p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleBack}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-semibold rounded-lg transition-all duration-300"
            >
              ← Go Back
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 font-medium rounded-lg transition-all duration-300 border border-gray-700"
            >
              🔄 Try Again
            </button>
          </div>
          
          <div className="mt-6 pt-6 border-t border-red-700/30">
            <p className="text-xs text-red-400/70 text-center">
              If this issue persists, please contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 text-white p-4">
      {/* Main Card */}
      <div className="max-w-md mx-auto mt-8 bg-gradient-to-br from-purple-900/40 to-purple-800/30 rounded-2xl p-6 border border-purple-700/50 backdrop-blur-sm shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-400/50 shadow-lg">
            <span className="text-3xl">↓</span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Secure Download
          </h1>
          <p className="text-purple-300/80 text-sm mt-2">{title}</p>
        </div>
        
        {/* Countdown */}
        <div className="mb-8">
          <div className="text-center mb-4">
            <div className="text-5xl font-bold text-blue-400 mb-2">{countdown}</div>
            <p className="text-purple-300 text-sm">Auto-download in {countdown} seconds</p>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-purple-800/50 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-linear"
              style={{ width: `${((5 - countdown) / 5) * 100}%` }}
            ></div>
          </div>
        </div>
        
        {/* Link Status */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-purple-300">Link Status</h3>
            <div className="text-xs bg-purple-700/50 text-purple-300 px-2 py-1 rounded-full">
              {activeLinks.length} Active / {getActiveLinkCount()} Global
            </div>
          </div>
          
          {/* Global link indicators */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((num) => {
              const isActive = linkSettings[`link${num}` as keyof LinkSettings];
              const hasLink = activeLinks.length >= num;
              
              return (
                <div 
                  key={num}
                  className={`text-center p-2 rounded-lg ${
                    isActive && hasLink
                      ? 'bg-green-600/20 border border-green-500/50'
                      : !isActive
                      ? 'bg-red-600/20 border border-red-500/50'
                      : 'bg-gray-800/50 border border-gray-700'
                  }`}
                  title={
                    !isActive ? 'Disabled globally by admin' :
                    !hasLink ? 'No link provided for this content' :
                    'Active and available'
                  }
                >
                  <div className="font-bold text-white text-sm">L{num}</div>
                  <div className="text-xs">
                    {!isActive ? '❌' : hasLink ? '✅' : '—'}
                  </div>
                </div>
              );
            })}
          </div>
          
          <p className="text-xs text-purple-400/70 text-center">
            Only globally enabled links (✅) are available for download
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleManualDownload}
            disabled={isDownloading || activeLinks.length === 0}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
          >
            {isDownloading ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                Downloading...
              </>
            ) : (
              <>
                <span>🚀</span>
                Download Now {countdown > 0 && `(Skip ${countdown}s)`}
              </>
            )}
          </button>
          
          <button
            onClick={handleBack}
            className="w-full py-3 bg-gradient-to-r from-purple-800/30 to-purple-900/30 hover:from-purple-700/40 hover:to-purple-800/40 text-purple-300 font-medium rounded-lg transition-all duration-300 border border-purple-700/50"
          >
            ← Back to Content
          </button>
        </div>
        
        {/* Info Box */}
        <div className="mt-8 pt-6 border-t border-purple-700/30">
          <div className="flex items-start gap-3">
            <div className="text-purple-400 text-lg">💡</div>
            <div>
              <h4 className="text-sm font-semibold text-purple-300 mb-2">How it works</h4>
              <ul className="text-xs text-purple-400/80 space-y-1">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Admin controls which download links are active globally</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Random active link is selected for each download</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Disabled links (❌) won't appear in downloads</span>
                </li>
                {isMobile && (
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Allow pop-ups for automatic downloads</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="max-w-md mx-auto mt-6 text-center">
        <p className="text-xs text-purple-500/60">
          AnimeBing • Secure Download System
        </p>
        <p className="text-[10px] text-purple-500/40 mt-1">
          {activeLinks.length} active link{activeLinks.length !== 1 ? 's' : ''} • {getActiveLinkCount()}/5 globally enabled
        </p>
      </div>
    </div>
  );
};

export default DownloadRedirectPage;
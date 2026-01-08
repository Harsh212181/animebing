 // components/Footer.tsx - CLEAN VERSION WITHOUT DEBUG PANEL
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';

interface SocialMedia {
  platform: string;
  url: string;
  isActive: boolean;
  icon: string;
  displayName: string;
}

interface AppDownload {
  platform: string;
  downloadUrl: string;
}

const Footer: React.FC = () => {
  const [socialLinks, setSocialLinks] = useState<SocialMedia[]>([
    // ✅ Default hardcoded links
    {
      platform: 'facebook',
      url: 'https://www.facebook.com/animebing',
      isActive: true,
      icon: 'facebook',
      displayName: 'Facebook'
    },
    {
      platform: 'instagram',
      url: 'https://www.instagram.com/animebing',
      isActive: true,
      icon: 'instagram',
      displayName: 'Instagram'
    },
    {
      platform: 'telegram',
      url: 'https://t.me/animebing',
      isActive: true,
      icon: 'telegram',
      displayName: 'Telegram'
    }
  ]);
  
  const [appDownloads, setAppDownloads] = useState<AppDownload[]>([]);
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ CORRECT API BASE URL
  const API_BASE = 'https://animabing.onrender.com';

  useEffect(() => {
    // Try to fetch from API silently
    fetchSocialLinks();
    fetchAppDownloads();
  }, []);

  const fetchSocialLinks = async () => {
    try {
      setLoading(true);
      
      const response = await axios.get(`${API_BASE}/api/social`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const activeLinks = response.data.filter((link: SocialMedia) => link.isActive);
        if (activeLinks.length > 0) {
          setSocialLinks(activeLinks);
        }
      }
    } catch (error: any) {
      // Silently fall back to hardcoded links
      console.log('Using default social links');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppDownloads = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/app-downloads`);
      if (Array.isArray(response.data)) {
        setAppDownloads(response.data);
      } else {
        setAppDownloads([]);
      }
    } catch (error) {
      console.error('Failed to fetch app downloads');
      setAppDownloads([]);
    }
  };

  const getAppDownload = (platform: string) => {
    if (!Array.isArray(appDownloads)) return undefined;
    return appDownloads.find(app => app.platform === platform);
  };

  const androidApp = getAppDownload('android');
  const iosApp = getAppDownload('ios');

  // ✅ FINAL FIX: DIRECT URL CHANGE FOR HOME PAGE LINKS
  const handleQuickLinkClick = async (type: string) => {
    if (isNavigating) return;
   
    setIsNavigating(true);
   
    let newUrl = window.location.origin;
   
    switch(type) {
      case 'home':
        newUrl = window.location.origin + '/';
        break;
      case 'hindi-dub':
        newUrl = window.location.origin + '/?filter=Hindi+Dub';
        break;
      case 'hindi-sub':
        newUrl = window.location.origin + '/?filter=Hindi+Sub';
        break;
      case 'english-sub':
        newUrl = window.location.origin + '/?filter=English+Sub';
        break;
      case 'movies':
        newUrl = window.location.origin + '/?contentType=Movie';
        break;
      case 'manga':
        newUrl = window.location.origin + '/?contentType=Manga';
        break;
      case 'anime-list':
        navigate('/anime');
        setTimeout(() => setIsNavigating(false), 800);
        return;
      default:
        newUrl = window.location.origin + '/';
    }
    
    window.location.href = newUrl;
    setTimeout(() => setIsNavigating(false), 1500);
  };

  const handlePageNavigation = async (path: string) => {
    if (isNavigating) return;
   
    setIsNavigating(true);
   
    if (location.pathname !== path) {
      navigate(path);
    }
   
    setTimeout(() => setIsNavigating(false), 800);
  };

  const NavigationLoader = () => (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <h3 className="text-white text-xl font-semibold mb-2">Loading animebing.in</h3>
        <p className="text-slate-400">Preparing your content...</p>
      </div>
    </div>
  );

  const SocialIcon = ({ platform, className = "w-6 h-6" }: { platform: string; className?: string }) => {
    switch (platform) {
      case 'facebook':
        return (
          <svg className={className} fill="#1877F2" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        );
      case 'instagram':
        return (
          <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fdf497"/>
                <stop offset="30%" stopColor="#fd5949"/>
                <stop offset="60%" stopColor="#d6249f"/>
                <stop offset="100%" stopColor="#285AEB"/>
              </linearGradient>
            </defs>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="url(#instagram-gradient)"/>
          </svg>
        );
      case 'telegram':
        return (
          <svg className={className} fill="#0088CC" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.139l-1.671 7.894c-.236 1.001-.837 1.248-1.697.775l-4.688-3.454-2.26 2.178c-.249.249-.459.459-.935.459l.336-4.773 8.665-5.515c.387-.247.741-.112.45.141l-7.07 6.389-3.073-.967c-1.071-.336-1.092-1.071.223-1.585l12.18-4.692c.892-.336 1.674.223 1.383 1.383z"/>
          </svg>
        );
      default:
        return (
          <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2 16h-2v-6h2v6zm-1-6.891c-.607 0-1.1-.496-1.1-1.109 0-.612.492-1.109 1.1-1.109s1.1.497 1.1 1.109c0 .613-.493 1.109-1.1 1.109zm8 6.891h-1.998v-2.861c0-1.881-2.002-1.722-2.002 0v2.861h-2v-6h2v1.093c.872-1.616 4-1.736 4 1.548v3.359z"/>
          </svg>
        );
    }
  };

  return (
    <>
      {isNavigating && <NavigationLoader />}
     
      <footer className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border-t border-purple-500/20">
        <div className="container mx-auto py-12 px-4">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Brand Section */}
            <div className="text-center lg:text-left">
              <h3 className="text-2xl font-bold text-white flex items-center justify-center lg:justify-start mb-4">
                <span 
                  className="text-xl md:text-2xl mr-1"
                  style={{
                    fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "EmojiOne Color", "Android Emoji", sans-serif',
                    textShadow: '0 0 1px rgba(255,255,255,0.5)',
                    filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.3))'
                  }}
                >
                  ☠️
                </span>
                <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  anime<span className="text-purple-400">bing.in</span>
                </span>
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Your ultimate destination for anime and movies. Watch, download, and enjoy your favorite content in high quality.
              </p>
              
              {/* Social Media Links - ALWAYS SHOW ICONS */}
              <div className="flex justify-center lg:justify-start space-x-4">
                {socialLinks.map(link => (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="group bg-slate-800/50 hover:bg-purple-600 text-slate-400 hover:text-white p-3 rounded-xl transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-purple-500/25 backdrop-blur-sm"
                    title={`Follow us on ${link.displayName}`}
                    onClick={(e) => {
                      // Open in new tab by default
                      e.preventDefault();
                      window.open(link.url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <SocialIcon platform={link.platform} className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>
            
            {/* Quick Links */}
            <div className="text-center">
              <h4 className="text-white font-semibold mb-4 text-lg">Quick Links</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <button
                  onClick={() => handleQuickLinkClick('home')}
                  className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Home
                </button>
                <button
                  onClick={() => handleQuickLinkClick('hindi-dub')}
                  className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Hindi Dub
                </button>
                <button
                  onClick={() => handleQuickLinkClick('hindi-sub')}
                  className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Hindi Sub
                </button>
                <button
                  onClick={() => handleQuickLinkClick('english-sub')}
                  className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  English Sub
                </button>
                <button
                  onClick={() => handleQuickLinkClick('movies')}
                  className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Movies
                </button>
                <button
                  onClick={() => handleQuickLinkClick('manga')}
                  className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Manga
                </button>
                <button
                  onClick={() => handleQuickLinkClick('anime-list')}
                  className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Anime List
                </button>
              </div>
            </div>
            
            {/* App Download Section */}
            <div className="text-center lg:text-right">
              <h4 className="text-white font-semibold mb-4 text-lg">Download App</h4>
              <p className="text-slate-400 text-sm mb-4">
                Get the best anime experience on your mobile device
              </p>
              <div className="flex flex-col space-y-3">
                <a
                  href={androidApp?.downloadUrl || '#'}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-3 font-semibold"
                  onClick={(e) => {
                    if (!androidApp?.downloadUrl || androidApp.downloadUrl === '#') {
                      e.preventDefault();
                      alert('Android APK download will be available soon!');
                    }
                  }}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8453 7.8508 12 7.8508s-3.5902.3931-5.1692 1.0788L4.8085 5.4267a.4161.4161 0 00-.5676-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592c-3.5721 2.165-4.1312 6.379-4.1312 8.1875 0 .4666.3785.8451.8451.8451h16.3806c.4666 0 .8451-.3785.8451-.8451.0001-1.8085-.559-6.0225-4.1311-8.1875"/>
                  </svg>
                  Download for Android
                </a>
                <a
                  href={iosApp?.downloadUrl || '#'}
                  className="bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-3 font-semibold"
                  onClick={(e) => {
                    if (!iosApp?.downloadUrl || iosApp.downloadUrl === '#') {
                      e.preventDefault();
                      alert('iOS app coming soon to App Store!');
                    }
                  }}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  Download for iOS
                </a>
              </div>
            </div>
          </div>
          
          {/* Bottom Section */}
          <div className="border-t border-slate-700/50 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              {/* Legal Links */}
              <div className="flex flex-wrap justify-center gap-6 text-sm">
                <button
                  onClick={() => handlePageNavigation('/terms')}
                  className="text-slate-400 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Terms & Conditions
                </button>
                <button
                  onClick={() => handlePageNavigation('/privacy')}
                  className="text-slate-400 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Privacy Policy
                </button>
                <button
                  onClick={() => handlePageNavigation('/dmca')}
                  className="text-slate-400 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  DMCA
                </button>
                <button
                  onClick={() => handlePageNavigation('/contact')}
                  className="text-slate-400 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Contact
                </button>
              </div>
              
              {/* Copyright */}
              <div className="text-center md:text-right">
                <p className="text-slate-400 text-sm font-medium">
                  &copy; {new Date().getFullYear()} animebing.in. All Rights Reserved.
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  Stream your favorite anime anytime, anywhere
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;
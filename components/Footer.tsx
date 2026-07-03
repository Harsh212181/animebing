 import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SocialMedia {
  _id?: string;
  platform: string;
  url: string;
  isActive: boolean;
  icon: string;
  displayName: string;
}

const Footer: React.FC = () => {
  const FALLBACK_LINKS: SocialMedia[] = [
    {
      platform: 'instagram',
      url: 'https://instagram.com/animebingofficial',
      isActive: true,
      icon: 'instagram',
      displayName: 'Instagram'
    },
    {
      platform: 'telegram',
      url: 'https://t.me/animebingofficial',
      isActive: true,
      icon: 'telegram',
      displayName: 'Telegram'
    },
    {
      platform: 'facebook',
      url: 'https://facebook.com/animebingofficial',
      isActive: true,
      icon: 'facebook',
      displayName: 'Facebook'
    }
  ];

  const [socialLinks, setSocialLinks] = useState<SocialMedia[]>(FALLBACK_LINKS);
  const navigate = useNavigate();
  const location = useLocation();

  const SOCIAL_API_URL = 'https://animabing-backend.animabingwatch.workers.dev/api/social';

  useEffect(() => {
    fetchSocialLinks();
  }, []);

  const fetchSocialLinks = async () => {
    try {
      const response = await fetch(`${SOCIAL_API_URL}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log('✅ Social links API response:', data);
      
      if (data && Array.isArray(data) && data.length > 0) {
        const merged = FALLBACK_LINKS.map(fallback => {
          const fetched = data.find((item: any) => item.platform === fallback.platform);
          if (fetched) {
            return {
              ...fallback,
              url: fetched.url,
              isActive: fetched.isActive === true || fetched.isActive === 'true' || fetched.isActive === 'Active',
            };
          }
          return fallback;
        });
        
        setSocialLinks(merged);
        console.log('Merged social links:', merged);
      } else {
        console.warn('API empty, using fallback');
        setSocialLinks(FALLBACK_LINKS);
      }
    } catch (error: any) {
      console.error('❌ Social links fetch failed:', error);
    }
  };

  const handleQuickLinkClick = (type: string) => {
    switch (type) {
      case 'home':
        navigate('/');
        break;
      case 'hindi-dub':
        navigate('/?filter=Hindi+Dub');
        break;
      case 'hindi-sub':
        navigate('/?filter=Hindi+Sub');
        break;
      case 'english-sub':
        navigate('/?filter=English+Sub');
        break;
      case 'movies':
        navigate('/?contentType=Movie');
        break;
      case 'manga':
        navigate('/?contentType=Manga');
        break;
      case 'anime-list':
        navigate('/anime');
        break;
      default:
        navigate('/');
    }
  };

  const handlePageNavigation = (path: string) => {
    if (location.pathname !== path) navigate(path);
  };

  const SocialIcon = ({ platform, className = "w-6 h-6" }: { platform: string; className?: string }) => {
    switch (platform) {
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
      case 'facebook':
        return (
          <svg className={className} fill="#1877F2" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
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

  const DownloadIcon = () => (
    <svg className="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );

  return (
    <>
      <style>{`
        .border-green-custom { border-color: #73F58A; }
        .border-green-custom-30 { border-color: rgba(115, 245, 138, 0.3); }
        .border-green-custom-50 { border-color: rgba(115, 245, 138, 0.5); }
        .border-green-custom-20 { border-color: rgba(115, 245, 138, 0.2); }
        .border-green-custom-70 { border-color: rgba(115, 245, 138, 0.7); }
        .glow-green {
          box-shadow: 0 0 5px rgba(115, 245, 138, 0.5),
                      0 0 10px rgba(115, 245, 138, 0.3),
                      0 0 15px rgba(115, 245, 138, 0.1);
        }
        .hover-glow-green:hover {
          box-shadow: 0 0 10px rgba(115, 245, 138, 0.6),
                      0 0 20px rgba(115, 245, 138, 0.4),
                      0 0 30px rgba(115, 245, 138, 0.2);
          transition: box-shadow 0.3s ease;
        }
        .footer-button {
          border: 1px solid rgba(115, 245, 138, 0.3);
          transition: all 0.3s ease;
        }
        .footer-button:hover {
          border: 1px solid #73F58A;
          box-shadow: 0 0 10px rgba(115, 245, 138, 0.4);
        }
      `}</style>

      <footer
        className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 glow-green"
        style={{
          borderTop: '3px solid #73F58A',
          borderTopWidth: '3px',
          borderTopStyle: 'solid',
          boxShadow: '0 -4px 20px rgba(115, 245, 138, 0.3)'
        }}
      >
        <div className="w-full px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="text-center lg:text-left">
              <h3 className="text-2xl font-bold text-white flex items-center justify-center lg:justify-start mb-4">
                <span
                  className="text-xl md:text-2xl mr-1"
                  style={{
                    fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "EmojiOne Color", "Android Emoji", sans-serif',
                    textShadow: '0 0 3px rgba(115, 245, 138, 0.7)',
                    filter: 'drop-shadow(0 0 2px rgba(115, 245, 138, 0.5))'
                  }}
                >
                  ☠️
                </span>
                <span className="bg-gradient-to-r from-white to-green-200 bg-clip-text text-transparent">
                  anime<span className="text-green-400">bing.in</span>
                </span>
              </h3>
              <p className="text-purple-300 text-sm mb-4">
                Your ultimate destination for anime and movies. Watch, download, and enjoy your favorite content in high quality.
              </p>

              <div className="flex justify-center lg:justify-start space-x-4">
                {socialLinks.map(link => (
                  <button
                    key={link.platform}
                    onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                    className="group bg-purple-800/50 hover:bg-green-500/30 text-green-400 hover:text-white p-3 rounded-xl transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-green-500/25 backdrop-blur-sm footer-button hover-glow-green"
                    title={`Follow us on ${link.displayName}`}
                  >
                    <SocialIcon platform={link.platform} className="w-5 h-5" />
                  </button>
                ))}
              </div>

              {/* Download Buttons - AnimeBing App temporarily hidden, only Dashboard remains */}
              <div className="mt-6 flex items-center gap-3 justify-center lg:justify-start">
                {/* AnimeBing App link removed for now */}
                {/* 
                <a
                  href="go.animebing.in/animebingapp"
                  download
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-purple-800/50 border border-purple-400/30 hover:border-purple-300/70 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20"
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
                    <DownloadIcon />
                  </div>
                  <span className="text-white text-sm font-medium">AnimeBing App</span>
                </a>
                */}

                {/* AnimeBing Dashboard */}
                <a
                  href="https://english.animebing.in/animebing-dashboard.apk"
                  download
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-purple-800/50 border border-purple-400/30 hover:border-purple-300/70 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20"
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
                    <DownloadIcon />
                  </div>
                  <span className="text-white text-sm font-medium">AnimeBing Dashboard</span>
                </a>
              </div>
            </div>

            <div className="text-center lg:text-right">
              <h4 className="text-white font-semibold mb-4 text-lg">Quick Links</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <button onClick={() => handleQuickLinkClick('home')} className="text-purple-300 hover:text-green-400 transition-colors py-1.5 text-left font-medium bg-purple-800/30 hover:bg-green-500/20 rounded-lg px-2 footer-button">Home</button>
                <button onClick={() => handleQuickLinkClick('hindi-dub')} className="text-purple-300 hover:text-green-400 transition-colors py-1.5 text-left font-medium bg-purple-800/30 hover:bg-green-500/20 rounded-lg px-2 footer-button">Hindi Dub</button>
                <button onClick={() => handleQuickLinkClick('hindi-sub')} className="text-purple-300 hover:text-green-400 transition-colors py-1.5 text-left font-medium bg-purple-800/30 hover:bg-green-500/20 rounded-lg px-2 footer-button">Hindi Sub</button>
                <button onClick={() => handleQuickLinkClick('english-sub')} className="text-purple-300 hover:text-green-400 transition-colors py-1.5 text-left font-medium bg-purple-800/30 hover:bg-green-500/20 rounded-lg px-2 footer-button">English Sub</button>
                <button onClick={() => handleQuickLinkClick('movies')} className="text-purple-300 hover:text-green-400 transition-colors py-1.5 text-left font-medium bg-purple-800/30 hover:bg-green-500/20 rounded-lg px-2 footer-button">Movies</button>
                <button onClick={() => handleQuickLinkClick('manga')} className="text-purple-300 hover:text-green-400 transition-colors py-1.5 text-left font-medium bg-purple-800/30 hover:bg-green-500/20 rounded-lg px-2 footer-button">Manga</button>
                <button onClick={() => handleQuickLinkClick('anime-list')} className="text-purple-300 hover:text-green-400 transition-colors py-1.5 text-left font-medium bg-purple-800/30 hover:bg-green-500/20 rounded-lg px-2 footer-button">Anime List</button>
                <button onClick={() => handlePageNavigation('/contact')} className="text-purple-300 hover:text-green-400 transition-colors py-1.5 text-left font-medium bg-purple-800/30 hover:bg-green-500/20 rounded-lg px-2 footer-button">Contact</button>
              </div>
            </div>
          </div>

          <div className="border-t border-green-custom-30 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="flex flex-wrap justify-center gap-6 text-sm">
                <button onClick={() => handlePageNavigation('/terms')} className="text-purple-300 hover:text-green-400 transition-colors font-medium bg-purple-800/30 hover:bg-green-500/20 py-1.5 px-3 rounded-lg footer-button">Terms & Conditions</button>
                <button onClick={() => handlePageNavigation('/privacy')} className="text-purple-300 hover:text-green-400 transition-colors font-medium bg-purple-800/30 hover:bg-green-500/20 py-1.5 px-3 rounded-lg footer-button">Privacy Policy</button>
                <button onClick={() => handlePageNavigation('/dmca')} className="text-purple-300 hover:text-green-400 transition-colors font-medium bg-purple-800/30 hover:bg-green-500/20 py-1.5 px-3 rounded-lg footer-button">DMCA</button>
                <button onClick={() => handlePageNavigation('/contact')} className="text-purple-300 hover:text-green-400 transition-colors font-medium bg-purple-800/30 hover:bg-green-500/20 py-1.5 px-3 rounded-lg footer-button">Contact</button>
              </div>

              <div className="text-center md:text-right">
                <p className="text-purple-300 text-sm font-medium">
                  &copy; {new Date().getFullYear()} animebing.in. All Rights Reserved.
                </p>
                <p className="text-purple-400 text-xs mt-1">
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
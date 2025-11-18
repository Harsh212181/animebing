 // components/Footer.tsx - UPDATED VERSION
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

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
  const [socialLinks, setSocialLinks] = useState<SocialMedia[]>([]);
  const [appDownloads, setAppDownloads] = useState<AppDownload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSocialLinks();
    fetchAppDownloads();
  }, []);

  const fetchSocialLinks = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/social');
      if (response.data && Array.isArray(response.data)) {
        setSocialLinks(response.data.filter((link: SocialMedia) => link.isActive));
      } else {
        setDefaultLinks();
      }
    } catch (error) {
      console.error('Failed to fetch social links, using defaults');
      setDefaultLinks();
    } finally {
      setLoading(false);
    }
  };

  const fetchAppDownloads = async () => {
    try {
      const response = await axios.get('/api/app-downloads');
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

  const setDefaultLinks = () => {
    setSocialLinks([
      {
        platform: 'facebook',
        url: 'https://facebook.com/animabing',
        isActive: true,
        icon: 'facebook',
        displayName: 'Facebook'
      },
      {
        platform: 'instagram',
        url: 'https://instagram.com/animabing',
        isActive: true,
        icon: 'instagram',
        displayName: 'Instagram'
      },
      {
        platform: 'telegram',
        url: 'https://t.me/animabing',
        isActive: true,
        icon: 'telegram',
        displayName: 'Telegram'
      }
    ]);
  };

  const getAppDownload = (platform: string) => {
    if (!Array.isArray(appDownloads)) return undefined;
    return appDownloads.find(app => app.platform === platform);
  };

  const androidApp = getAppDownload('android');
  const iosApp = getAppDownload('ios');

  const handleQuickLinkClick = (type: string) => {
    const baseUrl = window.location.origin;

    switch(type) {
      case 'home':
        window.location.href = `${baseUrl}/`;
        break;
      case 'hindi-dub':
        window.location.href = `${baseUrl}/?filter=Hindi+Dub`;
        break;
      case 'hindi-sub':
        window.location.href = `${baseUrl}/?filter=Hindi+Sub`;
        break;
      case 'movies':
        window.location.href = `${baseUrl}/?contentType=Movie`;
        break;
      case 'manga':
        window.location.href = `${baseUrl}/?contentType=Manga`;
        break;
      case 'anime-list':
        window.location.href = `${baseUrl}/?view=list`;
        break;
      case 'search':
        setTimeout(() => {
          const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
        break;
      default:
        window.location.href = `${baseUrl}/`;
    }
  };

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
          <svg className={className} fill="#E4405F" viewBox="0 0 24 24">
            <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987c6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.22 14.815 3.73 13.664 3.73 12.367s.49-2.448 1.396-3.323c.875-.807 2.026-1.297 3.323-1.297s2.448.49 3.323 1.297c.906.875 1.396 2.026 1.396 3.323s-.49 2.448-1.396 3.323c-.875.807-2.026 1.297-3.323 1.297z"/>
            <circle cx="12.017" cy="12.029" r="3.21"/>
            <path d="M16.2 7.8c.3 0 .5-.2.5-.5s-.2-.5-.5-.5-.5.2-.5.5.2.5.5.5z"/>
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

  if (loading) {
    return (
      <footer className="bg-gradient-to-b from-[#0a0c1c] to-[#15182e] border-t border-purple-500/20 mt-12">
        <div className="container mx-auto py-12 px-4 text-center">
          <div className="animate-pulse flex justify-center space-x-8 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-12 h-12 bg-purple-500/20 rounded-xl"></div>
            ))}
          </div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-gradient-to-b from-[#0a0c1c] to-[#15182e] border-t border-purple-500/20 mt-12">
      <div className="container mx-auto py-12 px-4">

        {/* Main Footer Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">

          {/* Brand Section */}
          <div className="text-center lg:text-left">
            <h3 className="text-2xl font-bold text-white mb-4">
              Anim<span className="text-purple-500">abing</span>
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Your ultimate destination for anime and movies. Watch, download, and enjoy your favorite content in high quality.
            </p>

            {/* Social Media Links */}
            <div className="flex justify-center lg:justify-start space-x-4">
              {socialLinks.map(link => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-slate-800/50 hover:bg-purple-600 text-slate-400 hover:text-white p-3 rounded-xl transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-purple-500/25"
                  title={`Follow us on ${link.displayName}`}
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
                className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left"
              >
                Home
              </button>
              <button
                onClick={() => handleQuickLinkClick('hindi-dub')}
                className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left"
              >
                Hindi Dub
              </button>
              <button
                onClick={() => handleQuickLinkClick('hindi-sub')}
                className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left"
              >
                Hindi Sub
              </button>
              <button
                onClick={() => handleQuickLinkClick('movies')}
                className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left"
              >
                Movies
              </button>
              <button
                onClick={() => handleQuickLinkClick('manga')}
                className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left"
              >
                Manga
              </button>
              <button
                onClick={() => handleQuickLinkClick('anime-list')}
                className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left"
              >
                Anime List
              </button>
              <button
                onClick={() => handleQuickLinkClick('search')}
                className="text-slate-400 hover:text-purple-400 transition-colors py-1 text-left"
              >
                Search
              </button>
            </div>
          </div>

          {/* App Download Section */}
          <div className="text-center lg:text-right">
            <h4 className="text-white font-semibold mb-4 text-lg">📱 Download App</h4>
            <p className="text-slate-400 text-sm mb-4">
              Get the best anime experience on your mobile device
            </p>
            <div className="flex flex-col space-y-3">
              <a
                href={androidApp?.downloadUrl || '#'}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-3 font-semibold"
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
              <Link to="/terms" className="text-slate-400 hover:text-purple-400 transition-colors">Terms & Conditions</Link>
              <Link to="/privacy" className="text-slate-400 hover:text-purple-400 transition-colors">Privacy Policy</Link>
              <Link to="/dmca" className="text-slate-400 hover:text-purple-400 transition-colors">DMCA</Link>
              <Link to="/contact" className="text-slate-400 hover:text-purple-400 transition-colors">Contact</Link>
            </div>

            {/* Copyright */}
            <div className="text-center md:text-right">
              <p className="text-slate-400 text-sm">
                &copy; {new Date().getFullYear()} Animabing. All Rights Reserved.
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Stream your favorite anime anytime, anywhere
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
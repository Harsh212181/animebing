  // components/DownloadRedirectPage.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const DownloadRedirectPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const fileId = searchParams.get('id') || searchParams.get('fileId');
  const fileName = searchParams.get('fileName') || 'video.mp4';

  // Check if user is on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!fileId) {
      setError('Download link is invalid or missing file ID');
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          startDownload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fileId]);

  const startDownload = () => {
    setIsDownloading(true);
    
    if (!fileId) return;
    
    const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`;
    
    // For mobile, try to download directly
    if (isMobile) {
      // Create a hidden link element for mobile
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Show success message after 2 seconds
      setTimeout(() => {
        setIsDownloading(false);
      }, 2000);
    } else {
      // Desktop: open in new tab
      const newWindow = window.open(downloadUrl, '_blank');
      
      if (!newWindow) {
        setError('Please allow pop-ups for this site to start download.');
      } else {
        // Show success message after 2 seconds
        setTimeout(() => {
          setIsDownloading(false);
        }, 2000);
      }
    }
  };

  const handleManualDownload = () => {
    startDownload();
  };

  const handleGoBack = () => {
    window.history.back();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0c1c] flex flex-col p-4">
        <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-4 rounded-xl mb-6">
          <div className="container mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold text-white">AnimeBing Download</h1>
          </div>
        </div>
        
        <main className="flex-grow flex items-center justify-center">
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl shadow-lg p-6 w-full max-w-md border border-slate-700">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
              <svg className="w-8 h-8 md:w-10 md:h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.282 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white mb-3 text-center">Download Error</h1>
            <p className="text-slate-300 mb-6 text-center text-sm md:text-base">{error}</p>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all active:scale-95"
              >
                Try Again
              </button>
              <button
                onClick={handleGoBack}
                className="w-full bg-slate-700 text-white py-3 rounded-lg font-medium hover:bg-slate-600 transition-all active:scale-95"
              >
                Go Back
              </button>
            </div>
          </div>
        </main>
        
        <footer className="mt-8 bg-slate-900/80 p-4 text-center rounded-xl border border-slate-800">
          <p className="text-slate-400 text-xs md:text-sm">© {new Date().getFullYear()} AnimeBing. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c1c] flex flex-col p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-4 md:p-6 rounded-xl mb-6">
        <div className="container mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white">AnimeBing Download</h1>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl shadow-lg p-5 md:p-8 w-full max-w-lg border border-slate-700">
          {/* Header */}
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Download Ready</h1>
            <p className="text-slate-300 text-sm md:text-base">Your file is prepared for download</p>
          </div>
          
          {/* File Info */}
          <div className="flex items-center mb-6 md:mb-8 p-4 bg-slate-900/50 rounded-lg">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-900/30 rounded-lg flex items-center justify-center mr-3 md:mr-4 flex-shrink-0">
              <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-white truncate text-sm md:text-base">{fileName}</h2>
              <p className="text-xs md:text-sm text-slate-400 truncate">File ID: {fileId?.substring(0, 8)}...</p>
            </div>
          </div>

          {/* Countdown */}
          <div className="text-center mb-8 md:mb-10">
            <p className="text-slate-300 mb-3 text-sm md:text-base">Download will start automatically in:</p>
            <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 text-transparent bg-clip-text mb-2">
              {countdown}
            </div>
            <p className="text-slate-400 text-sm md:text-base">seconds</p>
          </div>

          {/* Download Status */}
          <div className="mb-6 md:mb-8">
            {isDownloading ? (
              <div className="text-center">
                <div className="inline-block w-14 h-14 md:w-16 md:h-16 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-white font-medium text-base md:text-lg">Download in progress...</p>
                <p className="text-xs md:text-sm text-slate-400 mt-1">
                  {isMobile ? 'Check your downloads folder' : 'Please wait while your file downloads'}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 md:mb-6">
                  <svg className="w-full h-full text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-white font-medium text-lg md:text-xl">Ready to download</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 md:space-y-4">
            <button
              onClick={handleManualDownload}
              disabled={isDownloading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 md:py-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl active:scale-95 touch-manipulation"
            >
              {isDownloading ? (
                <span className="flex items-center justify-center">
                  <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Downloading...
                </span>
              ) : (
                'Download Now'
              )}
            </button>

            <button
              onClick={handleGoBack}
              className="w-full border-2 border-slate-600 text-white py-3 rounded-lg font-medium hover:bg-slate-800/50 transition-all active:scale-95 touch-manipulation"
            >
              Go Back
            </button>
          </div>

          {/* Tips */}
          <div className="mt-8 md:mt-10 pt-5 md:pt-6 border-t border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 md:mb-4 flex items-center">
              <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Download Tips
            </h3>
            <ul className="text-xs md:text-sm text-slate-400 space-y-1.5 md:space-y-2">
              <li className="flex items-start">
                <span className="text-blue-400 mr-2 mt-0.5">•</span>
                <span>{isMobile ? 'Tap Download Now to start' : 'Allow pop-ups if download doesn\'t start'}</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2 mt-0.5">•</span>
                <span>Check your browser's downloads folder</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2 mt-0.5">•</span>
                <span>Use stable internet for faster download</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2 mt-0.5">•</span>
                <span>File size depends on video quality</span>
              </li>
              {isMobile && (
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2 mt-0.5">•</span>
                  <span>Large files may take time on mobile data</span>
                </li>
              )}
            </ul>
          </div>

          {/* Mobile-Specific Instructions */}
          {isMobile && !isDownloading && (
            <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-800/30">
              <p className="text-sm text-blue-300 font-medium mb-2">📱 Mobile Download Note:</p>
              <p className="text-xs text-blue-200">
                For best results, keep this page open until download completes. 
                If download doesn't start, tap "Download Now" again.
              </p>
            </div>
          )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="mt-8 bg-slate-900/80 p-4 text-center rounded-xl border border-slate-800">
        <p className="text-slate-400 text-xs md:text-sm">© {new Date().getFullYear()} AnimeBing. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default DownloadRedirectPage;

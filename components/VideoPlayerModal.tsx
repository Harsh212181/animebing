import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import VideoPlayer from './VideoPlayer';
import { isYouTubeUrl, getYouTubeId } from './utils/videoHelpers';

interface VideoPlayerModalProps {
  videoUrl: string;
  onClose: () => void;
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ videoUrl, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [forceLandscape, setForceLandscape] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ✅ Fullscreen detect karo + agar phone abhi bhi portrait hai to CSS rotate hack lagao
  useEffect(() => {
    const checkAndApplyRotation = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement;

      const isOurIframeFullscreen = fsElement === iframeRef.current;
      const isPortrait = window.innerHeight > window.innerWidth;

      if (isOurIframeFullscreen && isPortrait) {
        setForceLandscape(true);
      } else {
        setForceLandscape(false);
      }
    };

    const handleFullscreenChange = async () => {
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement;

      if (fsElement === iframeRef.current) {
        // Pehle real orientation lock try karo
        if (screen.orientation && 'lock' in screen.orientation) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch {
            // Lock fail hua, thoda wait karke check karo abhi bhi portrait hai kya
          }
        }
        setTimeout(checkAndApplyRotation, 300);
      } else {
        setForceLandscape(false);
        if (screen.orientation && 'unlock' in screen.orientation) {
          try {
            (screen.orientation as any).unlock();
          } catch {}
        }
      }
    };

    const events = ['fullscreenchange', 'webkitfullscreenchange'];
    events.forEach(event => document.addEventListener(event, handleFullscreenChange));
    window.addEventListener('resize', checkAndApplyRotation);
    window.addEventListener('orientationchange', checkAndApplyRotation);

    return () => {
      events.forEach(event => document.removeEventListener(event, handleFullscreenChange));
      window.removeEventListener('resize', checkAndApplyRotation);
      window.removeEventListener('orientationchange', checkAndApplyRotation);
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) onClose();
  };

  const isYouTube = isYouTubeUrl(videoUrl);
  const youTubeId = isYouTube ? getYouTubeId(videoUrl) : null;

  // ✅ CSS rotation hack — iframe ko khud rotate kar ke landscape jaisa dikhao
  const forcedLandscapeStyle: React.CSSProperties = forceLandscape
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vh',
        height: '100vw',
        transform: 'rotate(90deg) translateY(-100%)',
        transformOrigin: 'top left',
        border: 'none',
      }
    : {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        border: 'none',
      };

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-95"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-6xl mx-4">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300 z-10"
        >
          ✕
        </button>

        {isYouTube && youTubeId ? (
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              ref={iframeRef}
              style={forcedLandscapeStyle}
              src={`https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        ) : (
          <VideoPlayer src={videoUrl} />
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default VideoPlayerModal;
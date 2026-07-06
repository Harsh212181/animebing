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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceRotate, setForceRotate] = useState(false);

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

  // ✅ Fullscreen state track + agar abhi bhi portrait hai to CSS-rotate flag on karo
  useEffect(() => {
    const updateRotateState = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement;
      const isOurFs = fsElement === wrapperRef.current;
      setIsFullscreen(isOurFs);

      if (isOurFs && window.innerHeight > window.innerWidth) {
        setForceRotate(true);
      } else {
        setForceRotate(false);
      }
    };

    const events = ['fullscreenchange', 'webkitfullscreenchange'];
    events.forEach(event => document.addEventListener(event, updateRotateState));
    window.addEventListener('resize', updateRotateState);
    window.addEventListener('orientationchange', updateRotateState);

    return () => {
      events.forEach(event => document.removeEventListener(event, updateRotateState));
      window.removeEventListener('resize', updateRotateState);
      window.removeEventListener('orientationchange', updateRotateState);
    };
  }, []);

  const handleFullscreen = async () => {
    if (!wrapperRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
        // Real lock try karo — kaam kare to CSS rotate ki zaroorat hi nahi padegi
        if (screen.orientation && 'lock' in screen.orientation) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch (err) {
            console.warn('Orientation lock not supported, using CSS fallback:', err);
          }
        }
      } else {
        if (screen.orientation && 'unlock' in screen.orientation) {
          try {
            (screen.orientation as any).unlock();
          } catch {}
        }
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) onClose();
  };

  const isYouTube = isYouTubeUrl(videoUrl);
  const youTubeId = isYouTube ? getYouTubeId(videoUrl) : null;

  // ✅ CSS rotate hack — sirf tab jab real orientation lock kaam na kare
  const rotatedContainerStyle: React.CSSProperties = forceRotate
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: '100vh',
        height: '100vw',
        transform: 'translate(-50%, -50%) rotate(90deg)',
      }
    : {
        position: 'relative',
        width: '100%',
        height: '100%',
      };

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-95"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-6xl mx-4">
        {!isFullscreen && (
          <button
            onClick={onClose}
            className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300 z-10"
          >
            ✕
          </button>
        )}

        {isYouTube && youTubeId ? (
          <div
            ref={wrapperRef}
            className="relative w-full aspect-video bg-black rounded-lg overflow-hidden"
          >
            <div style={rotatedContainerStyle}>
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0&fs=0&playsinline=1`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>

            {!forceRotate && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex justify-end z-20">
                <button
                  onClick={handleFullscreen}
                  className="text-white/90 hover:text-white text-xl px-2 transition-colors"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? '⤫' : '⛶'}
                </button>
              </div>
            )}

            {forceRotate && (
              <button
                onClick={handleFullscreen}
                className="fixed bottom-4 right-4 z-30 bg-black/60 text-white/90 hover:text-white text-xl px-3 py-2 rounded-lg transition-colors"
              >
                ⤫
              </button>
            )}
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
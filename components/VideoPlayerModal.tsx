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

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement;
      setIsFullscreen(fsElement === wrapperRef.current);
    };
    const events = ['fullscreenchange', 'webkitfullscreenchange'];
    events.forEach(event => document.addEventListener(event, handleFullscreenChange));
    return () => events.forEach(event => document.removeEventListener(event, handleFullscreenChange));
  }, []);

  // ✅ Ye hamara apna wrapper fullscreen karega — same-origin, isliye orientation lock reliably kaam karega
  const handleFullscreen = async () => {
    if (!wrapperRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
        if (screen.orientation && 'lock' in screen.orientation) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch (err) {
            console.warn('Orientation lock failed:', err);
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
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              // ✅ fs=0 — YouTube ka apna fullscreen button hide kar diya
              src={`https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0&fs=0&playsinline=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />

            {/* ✅ Hamara apna fullscreen button — VideoPlayer.tsx jaisa hi style */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex justify-end">
              <button
                onClick={handleFullscreen}
                className="text-white/90 hover:text-white text-xl px-2 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? '⤫' : '⛶'}
              </button>
            </div>
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
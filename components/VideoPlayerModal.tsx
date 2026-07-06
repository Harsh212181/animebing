import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import VideoPlayer from './VideoPlayer';
import { isYouTubeUrl, getYouTubeId } from './utils/videoHelpers';

interface VideoPlayerModalProps {
  videoUrl: string;
  onClose: () => void;
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ videoUrl, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

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
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300 z-10"
        >
          ✕
        </button>

        {isYouTube && youTubeId ? (
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
import React, { useEffect, useRef, useState } from 'react';
import { getYouTubeId } from './utils/videoHelpers';

interface YouTubeEmbedProps {
  videoUrl: string;
  title?: string;
}

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ videoUrl, title }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceRotate, setForceRotate] = useState(false);

  const youTubeId = getYouTubeId(videoUrl);

  useEffect(() => {
    const updateState = () => {
      const fsElement =
        document.fullscreenElement || (document as any).webkitFullscreenElement;
      const isOurFs = fsElement === wrapperRef.current;
      setIsFullscreen(isOurFs);
      if (isOurFs && window.innerHeight > window.innerWidth) {
        setForceRotate(true);
      } else {
        setForceRotate(false);
      }
    };

    const events = ['fullscreenchange', 'webkitfullscreenchange'];
    events.forEach(e => document.addEventListener(e, updateState));
    window.addEventListener('resize', updateState);
    window.addEventListener('orientationchange', updateState);

    return () => {
      events.forEach(e => document.removeEventListener(e, updateState));
      window.removeEventListener('resize', updateState);
      window.removeEventListener('orientationchange', updateState);
    };
  }, []);

  const handleFullscreen = async () => {
    if (!wrapperRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
        if (screen.orientation && 'lock' in screen.orientation) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch (err) {
            console.warn('Orientation lock not supported, CSS fallback will handle it:', err);
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

  if (!youTubeId) return null;

  const rotatedStyle: React.CSSProperties = forceRotate
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: '100vh',
        height: '100vw',
        transform: 'translate(-50%, -50%) rotate(90deg)',
      }
    : {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      };

  return (
    <div
      ref={wrapperRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-purple-500/30"
    >
      <div style={rotatedStyle}>
        <iframe
          className="absolute top-0 left-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0&fs=0&playsinline=1`}
          title={title || 'YouTube video player'}
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
  );
};

export default YouTubeEmbed;
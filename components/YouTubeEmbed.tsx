 import React, { useEffect, useRef, useState } from 'react';
import { SkipBack, SkipForward } from 'lucide-react';
import { getYouTubeId } from './utils/videoHelpers';

interface YouTubeEmbedProps {
  videoUrl: string;
  title?: string;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
}

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  videoUrl,
  title,
  onNextEpisode,
  onPreviousEpisode,
  hasNextEpisode = false,
  hasPreviousEpisode = false,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playing, setPlaying] = useState(true); // autoplay=1 se start

  const youTubeId = getYouTubeId(videoUrl);

  // ✅ Iframe ka `src` sirf ek baar (first mount) set hota hai — kabhi
  // dubara change nahi karte (cross-origin navigation fullscreen tod deta).
  // Episode switch YouTube IFrame API (postMessage) se in-place hota hai.
  const initialYouTubeIdRef = useRef(youTubeId);
  const isFirstLoadRef = useRef(true);

  const postCommand = (func: string, args: any[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
  };

  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      return;
    }
    if (youTubeId) {
      postCommand('loadVideoById', [youTubeId]);
      setPlaying(true);
    }
  }, [youTubeId]);

  // ✅ YouTube ke apne playerState messages sunkar humara `playing` state
  // sync rakho — chahe user ne YouTube ke native play/pause se control kiya ho.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.event === 'infoDelivery' && data.info && typeof data.info.playerState === 'number') {
          const state = data.info.playerState;
          if (state === 1) setPlaying(true);   // playing
          else if (state === 2) setPlaying(false); // paused
        }
      } catch {
        // ignore unrelated messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ✅ Fullscreen state track + orientation LOCK jab bhi fullscreen ho
  // (chahe YouTube ke apne native button se ho ya humare auto-trigger se)
  useEffect(() => {
    const handleFullscreenChange = async () => {
      const fsElement =
        document.fullscreenElement || (document as any).webkitFullscreenElement;
      const nowFullscreen = !!fsElement;
      setIsFullscreen(nowFullscreen);

      if (nowFullscreen) {
        if (screen.orientation && 'lock' in screen.orientation) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch (err) {
            console.warn('Orientation lock not supported:', err);
          }
        }
      } else {
        if (screen.orientation && 'unlock' in screen.orientation) {
          try {
            (screen.orientation as any).unlock();
          } catch {}
        }
      }
    };

    const events = ['fullscreenchange', 'webkitfullscreenchange'];
    events.forEach(e => document.addEventListener(e, handleFullscreenChange));
    return () => {
      events.forEach(e => document.removeEventListener(e, handleFullscreenChange));
    };
  }, []);

  // ✅ User phone ko landscape mein GHUMAYE aur video PLAY ho raha ho →
  // apne aap fullscreen ho jaye. (Note: kuch mobile browsers — khaaskar
  // iOS Safari — sirf direct tap par fullscreen allow karte hain, isliye
  // ye sab jagah guaranteed kaam nahi karega; Android Chrome mein zyada
  // chances hain.)
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const fsElement =
        document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (isLandscape && playing && !fsElement && wrapperRef.current) {
        wrapperRef.current.requestFullscreen?.().catch((err) => {
          console.warn('Auto-fullscreen on rotate failed (browser restriction):', err);
        });
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [playing]);

  // ✅ Controls (Previous/Next) 3 second baad auto-hide
  const showControlsTemporarily = () => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  };

  useEffect(() => {
    showControlsTemporarily();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    showControlsTemporarily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  const handleNextEpisode = () => {
    if (onNextEpisode) onNextEpisode();
    showControlsTemporarily();
  };

  const handlePreviousEpisode = () => {
    if (onPreviousEpisode) onPreviousEpisode();
    showControlsTemporarily();
  };

  if (!youTubeId) return null;

  const ICON_SIZE = 18;
  const BTN_CLASS =
    'flex items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors duration-150 p-2';
  const DISABLED_BTN_CLASS =
    'flex items-center justify-center rounded-full text-white/25 cursor-not-allowed p-2';

  return (
    <div
      ref={wrapperRef}
      className="relative w-full aspect-video bg-black rounded-none border-0 sm:rounded-xl sm:border sm:border-purple-500/30 overflow-hidden"
    >
      <iframe
        ref={iframeRef}
        className="absolute top-0 left-0 w-full h-full"
        // ✅ fs=1 → YouTube ka apna native fullscreen button dikhega
        src={`https://www.youtube-nocookie.com/embed/${initialYouTubeIdRef.current}?autoplay=1&rel=0&fs=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(
          typeof window !== 'undefined' ? window.location.origin : ''
        )}`}
        title={title || 'YouTube video player'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />

      {/* ✅ Sirf Previous/Next Episode — Play/Pause aur Fullscreen ab
          YouTube ke apne native controls se hota hai */}
      {(hasPreviousEpisode || hasNextEpisode) && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex items-center justify-start z-20 pointer-events-none transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className={`flex items-center gap-0.5 ${controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <button
              onClick={handlePreviousEpisode}
              disabled={!hasPreviousEpisode}
              className={hasPreviousEpisode ? BTN_CLASS : DISABLED_BTN_CLASS}
              aria-label="Previous episode"
              title="Previous Episode"
            >
              <SkipBack size={ICON_SIZE} fill="currentColor" />
            </button>
            <button
              onClick={handleNextEpisode}
              disabled={!hasNextEpisode}
              className={hasNextEpisode ? BTN_CLASS : DISABLED_BTN_CLASS}
              aria-label="Next episode"
              title="Next Episode"
            >
              <SkipForward size={ICON_SIZE} fill="currentColor" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default YouTubeEmbed;
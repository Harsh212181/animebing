 import React, { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Play, Pause } from 'lucide-react';
import { getYouTubeId } from './utils/videoHelpers';

interface YouTubeEmbedProps {
  videoUrl: string;
  title?: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// ✅ YouTube IFrame API ko sirf ek baar load karo (multiple players ke liye bhi safe)
let apiLoadPromise: Promise<void> | null = null;
const loadYouTubeAPI = (): Promise<void> => {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback();
      resolve();
    };

    // Agar API already load ho chuki hai (race condition safety)
    if (window.YT && window.YT.Player) resolve();
  });

  return apiLoadPromise;
};

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ videoUrl, title }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerDivRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceRotate, setForceRotate] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const youTubeId = getYouTubeId(videoUrl);

  // ✅ Player initialize karo — controls=0 se YouTube ka poora UI (logo, title,
  // channel name, watch-on-youtube link, related videos) hide ho jaata hai
  useEffect(() => {
    let destroyed = false;

    if (!youTubeId) return;

    loadYouTubeAPI().then(() => {
      if (destroyed || !playerDivRef.current) return;

      playerRef.current = new window.YT.Player(playerDivRef.current, {
        videoId: youTubeId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
        },
        events: {
          onReady: (e: any) => {
            if (destroyed) return;
            setReady(true);
            setDuration(e.target.getDuration());
            e.target.playVideo();
          },
          onStateChange: (e: any) => {
            if (destroyed) return;
            setPlaying(e.data === window.YT.PlayerState.PLAYING);
          },
        },
      });

      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current?.getCurrentTime) {
          setCurrentTime(playerRef.current.getCurrentTime());
        }
      }, 500);
    });

    return () => {
      destroyed = true;
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy();
        } catch {}
      }
    };
  }, [youTubeId]);

  // ✅ Fullscreen + auto-rotate-fallback logic (same as before)
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

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playing) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    playerRef.current?.seekTo(time, true);
  };

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

  const formatTime = (t: number) => {
    if (!isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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

  // Same fixed icon size / button treatment as the main VideoPlayer, so
  // both players feel like one consistent, professional control system.
  const ICON_SIZE = 18;
  const BTN_CLASS =
    'flex items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors duration-150 p-2';

  return (
    <div
      ref={wrapperRef}
      className="relative w-full aspect-video bg-black rounded-none border-0 sm:rounded-xl sm:border sm:border-purple-500/30 overflow-hidden"
      onClick={togglePlay}
    >
      <div style={rotatedStyle} onClick={(e) => e.stopPropagation()}>
        {/* ✅ YouTube IFrame API is div ko khud iframe mein convert kar dega */}
        <div ref={playerDivRef} className="w-full h-full pointer-events-none" />
      </div>

      {/* Loading spinner jab tak player ready na ho */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ✅ Pause hone par poora iframe cover karo — YouTube ka suggested-video overlay chhup jaayega */}
      {ready && !playing && !forceRotate && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 bg-black/85"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
        >
          <div className="bg-white/10 rounded-full p-5 hover:bg-white/20 transition-colors">
            <Play size={40} className="text-white" />
          </div>
        </div>
      )}

      {/* ✅ Apna custom control bar — YouTube ka koi UI overlay yahan nahi hai */}
      {!forceRotate && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full mb-1 accent-purple-500 h-1"
          />
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className={BTN_CLASS}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? <Pause size={ICON_SIZE} /> : <Play size={ICON_SIZE} />}
              </button>
              <span className="text-white/70 text-xs whitespace-nowrap">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <button
              onClick={handleFullscreen}
              className={BTN_CLASS}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize size={ICON_SIZE} /> : <Maximize size={ICON_SIZE} />}
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen + force-rotated state — sirf exit button dikhega, alag position mein */}
      {forceRotate && (
        <button
          onClick={handleFullscreen}
          className={`fixed bottom-4 right-4 z-30 bg-black/60 ${BTN_CLASS}`}
          aria-label="Exit fullscreen"
        >
          <Minimize size={ICON_SIZE} />
        </button>
      )}
    </div>
  );
};

export default YouTubeEmbed;
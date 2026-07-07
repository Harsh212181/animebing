 import React, { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceRotate, setForceRotate] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playing, setPlaying] = useState(true);

  const youTubeId = getYouTubeId(videoUrl);

  // ✅ FIX: the iframe's `src` is only ever set from this ref's value, taken
  // once at first mount. We NEVER change the iframe's `src` again after that.
  // Reason: changing a cross-origin iframe's `src` makes the browser
  // *navigate* it to a new page. If an ancestor element is in fullscreen at
  // that moment, browsers treat a cross-origin navigation inside it as a
  // security risk and force-exit fullscreen — which is exactly why Next/
  // Previous Episode was kicking you out of fullscreen for YouTube videos
  // (this never happened for the native <video> player because reassigning
  // its `src` isn't a cross-origin navigation).
  // Instead, once the iframe is loaded we switch videos in-place using the
  // YouTube IFrame Player API (postMessage commands), which never navigates
  // the frame and so never triggers that browser safeguard.
  const initialYouTubeIdRef = useRef(youTubeId);
  const isFirstLoadRef = useRef(true);

  const postCommand = (func: string, args: any[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
  };

  // Switch the loaded video in-place whenever the episode (videoUrl) changes.
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

  // ✅ Listen to the YouTube player's own state updates (play/pause/buffering)
  // so our custom button icon stays in sync even if playback is controlled
  // some other way (e.g. user taps the video itself).
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.event === 'infoDelivery' && data.info && typeof data.info.playerState === 'number') {
          const state = data.info.playerState;
          if (state === 1) setPlaying(true); // playing
          else if (state === 2) setPlaying(false); // paused
          // ✅ FIX: YouTube broadcasts a playerState change EVERY time
          // play/pause/seek/buffer happens — no matter whether it was
          // triggered by our custom button or by the user tapping
          // YouTube's own native controls inside the iframe. Using this
          // real event (instead of the old window-'blur' + iframe.blur()
          // hack) reliably re-shows our controls on every interaction
          // without ever touching the iframe's focus — so it can no
          // longer interfere with clicks on YouTube's native play button,
          // seek bar, volume, or settings gear.
          showControlsTemporarily();
        }
      } catch {
        // Ignore non-JSON / unrelated messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Controls ko 3 second ke baad auto-hide karo
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

  // ✅ Video (videoUrl) badalne par bhi controls dikha do — episode switch hote
  // hi user ko turant pata chale ki naya video load ho gaya, controls hide na
  // ho jaayein turant.
  useEffect(() => {
    showControlsTemporarily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  // ❌ HATA DIYA: pehle hum window 'blur' + iframeRef.current.blur() wala
  // hack use kar rahe the taake har tap detect ho sake. Lekin cross-origin
  // iframe ko programmatically blur() karna EXACTLY usi waqt ho raha tha
  // jab mobile browser tap ko iframe ke andar deliver kar raha hota tha —
  // isse browser wo tap/click hi cancel kar deta tha. Yahi wajah thi ki
  // YouTube ke apne saare controls (center play, progress bar, volume,
  // settings) click hona band ho gaye the.
  //
  // ✅ NAYA FIX: neeche "tap-catcher" overlay use kiya hai (return JSX mein)
  // jo sirf tab render hota hai jab controls hidden hain. Pehla tap us
  // invisible overlay ko milta hai (controls show karke khud hat jaata
  // hai), agla tap seedha iframe/YouTube tak pahunchta hai. Isse iframe ka
  // focus ya click event kabhi bhi disturb nahi hota.

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
    showControlsTemporarily();
  };

  const togglePlay = () => {
    if (playing) {
      postCommand('pauseVideo');
    } else {
      postCommand('playVideo');
    }
    setPlaying(!playing); // optimistic; message listener will correct it if needed
    showControlsTemporarily();
  };

  const handleNextEpisode = () => {
    if (onNextEpisode) onNextEpisode();
    showControlsTemporarily();
  };

  const handlePreviousEpisode = () => {
    if (onPreviousEpisode) onPreviousEpisode();
    showControlsTemporarily();
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
  const DISABLED_BTN_CLASS =
    'flex items-center justify-center rounded-full text-white/25 cursor-not-allowed p-2';

  // Reusable Previous - Play/Pause - Next cluster, same order as VideoPlayer.
  const EpisodeControls = () => (
    <div className="flex items-center gap-0.5">
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
        onClick={togglePlay}
        className={BTN_CLASS}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={ICON_SIZE} fill="currentColor" /> : <Play size={ICON_SIZE} fill="currentColor" />}
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
  );

  return (
    <div
      ref={wrapperRef}
      className="relative w-full aspect-video bg-black rounded-none border-0 sm:rounded-xl sm:border sm:border-purple-500/30 overflow-hidden"
    >
      <div style={rotatedStyle}>
        <iframe
          ref={iframeRef}
          className="absolute top-0 left-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${initialYouTubeIdRef.current}?autoplay=1&rel=0&fs=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(
            typeof window !== 'undefined' ? window.location.origin : ''
          )}`}
          title={title || 'YouTube video player'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>

      {/* ❌ HATA DIYA: pehle yahan ek full-screen "tap-catcher" tha jo
          controls hidden hone par poore video ke upar phail jaata tha.
          Isse HAR click pehle usi invisible div ko lagta tha (sirf
          controls dikhane ke liye), aur YouTube ke asli play/pause,
          settings, seek bar tak pahunchne ke liye user ko DO baar tap
          karna padta tha. Ab hum sirf window-focus + YouTube ke apne
          playerState messages (neeche useEffect) se controls dobara
          dikhate hain — bina kisi overlay ke jo click ko roke. */}

      {!forceRotate && (
        // ✅ FIX: container ab hamesha `pointer-events-none` hai — ye khud
        // kabhi click nahi khaata. Sirf iske andar ke actual buttons
        // (EpisodeControls aur Fullscreen) par `pointer-events-auto` hai.
        // Isse beech ka khaali/gap area (jahan YouTube ka apna seek bar,
        // settings gear, volume, audio-track button hote hain) click ke
        // liye seedha iframe tak "through" chala jaata hai.
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex items-center justify-between z-20 pointer-events-none transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className={controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'}>
            <EpisodeControls />
          </div>

          <button
            onClick={handleFullscreen}
            className={`${BTN_CLASS} ${controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={ICON_SIZE} /> : <Maximize size={ICON_SIZE} />}
          </button>
        </div>
      )}

      {forceRotate && (
        <>
          <button
            onClick={handleFullscreen}
            className={`fixed bottom-4 right-4 z-30 bg-black/60 ${BTN_CLASS}`}
            aria-label="Exit fullscreen"
          >
            <Minimize size={ICON_SIZE} />
          </button>
          <div className="fixed bottom-4 left-4 z-30 bg-black/60 rounded-full">
            <EpisodeControls />
          </div>
        </>
      )}
    </div>
  );
};

export default YouTubeEmbed;
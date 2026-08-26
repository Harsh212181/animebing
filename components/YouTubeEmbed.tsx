 import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Check,
} from 'lucide-react';
import { getYouTubeId } from './utils/videoHelpers';

interface YouTubeEmbedProps {
  videoUrl: string;
  title?: string;
  playerMode?: 'custom' | 'default';
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SKIP_SECONDS = 10;
const DOUBLE_TAP_MS = 300;
const SKIP_INDICATOR_MS = 800; // isi window ke andar dobara double-tap karne par amount jud jayega (10+ -> 20+ -> 30+)

type SkipSide = 'left' | 'right';

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  videoUrl,
  title,
  playerMode = 'custom',
  onNextEpisode,
  onPreviousEpisode,
  hasNextEpisode = false,
  hasPreviousEpisode = false,
}) => {
  const isCustom = playerMode === 'custom';

  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listeningIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100); // YouTube volume range: 0-100
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [seeking, setSeeking] = useState(false); // drag ke dauran infoDelivery se overwrite mat karo

  // ✅ NEW — left/right double-tap skip indicator (cumulative: 10+ -> 20+ -> 30+ ...)
  const [skipIndicator, setSkipIndicator] = useState<{ side: SkipSide; amount: number; key: number } | null>(null);
  const lastTapRef = useRef<{ side: SkipSide | 'center'; time: number } | null>(null);
  const singleClickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const skipStreakRef = useRef<{ side: SkipSide; amount: number; time: number } | null>(null); // ✅ NEW

  const youTubeId = getYouTubeId(videoUrl);

  const initialYouTubeIdRef = useRef(youTubeId);
  const isFirstLoadRef = useRef(true);

  const postCommand = (func: string, args: any[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
  };

  // ✅ NEW — YouTube ko batao ki hum listening mode me hain, tabhi wo
  // 'infoDelivery' events bhejna shuru karta hai (currentTime, duration,
  // volume, muted, playbackRate waghera). Ye handshake iframe ready hote
  // hi ek baar bhejni hoti hai, aur reliability ke liye thodi der repeat
  // (kuch players pehla message miss kar dete hain).
  const startListening = () => {
    if (listeningIntervalRef.current) clearInterval(listeningIntervalRef.current);
    let attempts = 0;
    listeningIntervalRef.current = setInterval(() => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: initialYouTubeIdRef.current }),
        '*'
      );
      attempts += 1;
      if (attempts >= 5 && listeningIntervalRef.current) {
        clearInterval(listeningIntervalRef.current);
      }
    }, 300);
  };

  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      return;
    }
    if (youTubeId) {
      postCommand('loadVideoById', [youTubeId]);
      setPlaying(true);
      setReady(false);
      setCurrentTime(0);
      setDuration(0);
      startListening();
    }
  }, [youTubeId]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (data?.event === 'infoDelivery' && data.info) {
          const info = data.info;
          if (!ready) setReady(true); // ✅ NEW — pehla real signal milte hi ready
          if (typeof info.playerState === 'number') {
            if (info.playerState === 1) setPlaying(true);
            else if (info.playerState === 2) setPlaying(false);
          }
          if (!seeking && typeof info.currentTime === 'number') {
            setCurrentTime(info.currentTime);
          }
          if (typeof info.duration === 'number' && info.duration > 0) {
            setDuration(info.duration);
          }
          if (typeof info.volume === 'number') setVolume(info.volume);
          if (typeof info.muted === 'boolean') setMuted(info.muted);
          if (typeof info.playbackRate === 'number') setPlaybackRate(info.playbackRate);
        }
      } catch {
        // ignore unrelated messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [seeking, ready]);

  // ✅ NEW — Safety net: agar kabhi bhi na onLoad fire ho na infoDelivery aaye,
  // to spinner stuck na rahe
  useEffect(() => {
    const fallback = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(fallback);
  }, [youTubeId]);

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

  const showControlsTemporarily = () => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
      setShowSpeedMenu(false);
      setShowVolumeSlider(false);
    }, 3000);
  };

  useEffect(() => {
    showControlsTemporarily();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (listeningIntervalRef.current) clearInterval(listeningIntervalRef.current);
      if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current); // ✅ NEW
    };
  }, []);

  useEffect(() => {
    showControlsTemporarily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  // ✅ NEW — skip indicator ko khud-ba-khud hide karo, aur streak bhi reset kar do
  // taaki agla double-tap wapas 10+ se shuru ho, na ki purani ginti aage badhaye
  useEffect(() => {
    if (!skipIndicator) return;
    const t = setTimeout(() => {
      setSkipIndicator(null);
      skipStreakRef.current = null;
    }, SKIP_INDICATOR_MS);
    return () => clearTimeout(t);
  }, [skipIndicator]);

  const handleNextEpisode = () => {
    if (onNextEpisode) onNextEpisode();
    showControlsTemporarily();
  };

  const handlePreviousEpisode = () => {
    if (onPreviousEpisode) onPreviousEpisode();
    showControlsTemporarily();
  };

  const handleIframeLoad = () => {
    setReady(true);
    startListening(); // ✅ NEW — iframe ready hote hi handshake shuru
  };

  const togglePlay = () => {
    if (!isCustom) return;
    if (playing) {
      postCommand('pauseVideo');
    } else {
      postCommand('playVideo');
    }
    setPlaying(!playing);
    showControlsTemporarily();
  };

  // ✅ NEW — seek bar
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeeking(true);
    setCurrentTime(Number(e.target.value));
  };
  const handleSeekCommit = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const time = Number(e.currentTarget.value);
    postCommand('seekTo', [time, true]);
    setCurrentTime(time);
    setSeeking(false);
    showControlsTemporarily();
  };

  // ✅ NEW — ±10s skip
  const skipBy = (delta: number) => {
    const target = Math.min(Math.max(currentTime + delta, 0), duration || currentTime + delta);
    postCommand('seekTo', [target, true]);
    setCurrentTime(target);
    showControlsTemporarily();
  };

  // ✅ NEW — left/right double-tap-to-skip zone handler.
  // Single tap => play/pause (thoda delay ke saath, taaki double-tap
  // detect ho sake). Double tap on left/right => -10s / +10s seek,
  // aur play/pause toggle nahi hota.
  const handleZoneTap = (side: SkipSide | 'center') => {
    const now = Date.now();
    const last = lastTapRef.current;
    const isDoubleTap =
      side !== 'center' && last && last.side === side && now - last.time < DOUBLE_TAP_MS;

    if (isDoubleTap) {
      if (singleClickTimerRef.current) {
        clearTimeout(singleClickTimerRef.current);
        singleClickTimerRef.current = null;
      }
      lastTapRef.current = null;
      const delta = side === 'left' ? -SKIP_SECONDS : SKIP_SECONDS;
      skipBy(delta);

      // ✅ NEW — agar isi side pe abhi-abhi (SKIP_INDICATOR_MS ke andar) skip hua tha,
      // to amount jod do (10 -> 20 -> 30...), warna naye sire se 10 se shuru karo
      const streak = skipStreakRef.current;
      const newAmount =
        streak && streak.side === side && now - streak.time < SKIP_INDICATOR_MS
          ? streak.amount + SKIP_SECONDS
          : SKIP_SECONDS;
      skipStreakRef.current = { side, amount: newAmount, time: now };
      setSkipIndicator({ side, amount: newAmount, key: now });
      return;
    }

    lastTapRef.current = { side, time: now };

    if (side === 'center') {
      togglePlay();
      return;
    }

    // pehla tap — thoda ruko, agar dusra tap nahi aaya to play/pause karo
    if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current);
    singleClickTimerRef.current = setTimeout(() => {
      togglePlay();
      singleClickTimerRef.current = null;
    }, DOUBLE_TAP_MS);
  };

  // ✅ NEW — volume + mute
  const toggleMute = () => {
    if (muted) {
      postCommand('unMute');
      setMuted(false);
    } else {
      postCommand('mute');
      setMuted(true);
    }
    showControlsTemporarily();
  };
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    postCommand('setVolume', [v]);
    setVolume(v);
    if (v === 0) {
      postCommand('mute');
      setMuted(true);
    } else if (muted) {
      postCommand('unMute');
      setMuted(false);
    }
    showControlsTemporarily();
  };

  // ✅ NEW — playback speed
  const changeSpeed = (rate: number) => {
    postCommand('setPlaybackRate', [rate]);
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    showControlsTemporarily();
  };

  const handleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (!isFullscreen) {
      wrapperRef.current.requestFullscreen?.().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    showControlsTemporarily();
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (!youTubeId) return null;

  const ICON_SIZE = 18;
  const BTN_CLASS =
    'flex items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors duration-150 p-2';
  const DISABLED_BTN_CLASS =
    'flex items-center justify-center rounded-full text-white/25 cursor-not-allowed p-2';

  const iframeParams = isCustom
    ? 'autoplay=1&rel=0&fs=0&controls=0&modestbranding=1&disablekb=1&iv_load_policy=3&playsinline=1&enablejsapi=1'
    : 'autoplay=1&rel=0&fs=1&playsinline=1&enablejsapi=1';

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full aspect-video bg-black rounded-none border-0 sm:rounded-xl sm:border sm:border-purple-500/30 overflow-hidden select-none"
      onMouseMove={isCustom ? showControlsTemporarily : undefined}
    >
      <style>{`
        input[type='range'].yt-progress-bar {
          -webkit-appearance: none;
          appearance: none;
          background: rgba(255,255,255,0.25);
          border-radius: 9999px;
          cursor: pointer;
        }
        input[type='range'].yt-progress-bar::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #a855f7;
          box-shadow: 0 0 0 3px rgba(168,85,247,0.25);
          margin-top: -1px;
        }
        input[type='range'].yt-progress-bar::-moz-range-thumb {
          width: 13px;
          height: 13px;
          border: none;
          border-radius: 50%;
          background: #a855f7;
        }
        @keyframes ytSkipPop {
          0% { opacity: 0; transform: scale(0.85); }
          15% { opacity: 1; transform: scale(1); }
          75% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.9); }
        }
        .yt-skip-indicator {
          animation: ytSkipPop 650ms ease-out forwards;
        }
      `}</style>

      <iframe
        ref={iframeRef}
        className={`absolute top-0 left-0 w-full h-full ${isCustom ? 'pointer-events-none' : ''}`}
        src={`https://www.youtube-nocookie.com/embed/${initialYouTubeIdRef.current}?${iframeParams}&origin=${encodeURIComponent(
          typeof window !== 'undefined' ? window.location.origin : ''
        )}`}
        title={title || 'YouTube video player'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen={!isCustom}
        onLoad={isCustom ? handleIframeLoad : undefined}
      />

      {isCustom && (
        <>
          {/* ✅ NEW — 3 tap zones: left (double-tap = -10s), center (play/pause),
              right (double-tap = +10s). Control bar area excluded. */}
          <div className="absolute inset-0 bottom-16 z-10 flex">
            <div
              className="w-2/5 h-full"
              onClick={() => handleZoneTap('left')}
              aria-label="Double tap to rewind 10 seconds"
            />
            <div
              className="w-1/5 h-full"
              onClick={() => handleZoneTap('center')}
            />
            <div
              className="w-2/5 h-full"
              onClick={() => handleZoneTap('right')}
              aria-label="Double tap to forward 10 seconds"
            />
          </div>

          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
              <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Centered play/pause overlay, YouTube-style */}
          {ready && !playing && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="flex items-center justify-center rounded-full bg-black/45" style={{ width: 64, height: 64 }}>
                <Play size={28} className="text-white ml-1" fill="white" />
              </div>
            </div>
          )}

          {/* ✅ NEW — double-tap skip indicator (left/right) */}
          {skipIndicator && (
            <div
              key={skipIndicator.key}
              className={`absolute top-0 bottom-16 z-20 flex items-center justify-center pointer-events-none ${
                skipIndicator.side === 'left' ? 'left-0 w-2/5' : 'right-0 w-2/5'
              }`}
            >
              <div className="yt-skip-indicator flex flex-col items-center gap-1 bg-black/55 rounded-full px-4 py-3">
                {skipIndicator.side === 'left' ? (
                  <SkipBack size={26} className="text-white" fill="white" />
                ) : (
                  <SkipForward size={26} className="text-white" fill="white" />
                )}
                <span className="text-white text-xs font-medium whitespace-nowrap">
                  {skipIndicator.amount}+ seconds
                </span>
              </div>
            </div>
          )}

          {/* ✅ Full custom control bar */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pt-3 pb-2 text-white z-30 transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeekChange}
              onMouseUp={handleSeekCommit}
              onTouchEnd={handleSeekCommit}
              className="w-full mb-1.5 yt-progress-bar"
              style={{ height: 4 }}
              onClick={(e) => e.stopPropagation()}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-0.5 min-w-0">
                <button
                  onClick={handlePreviousEpisode}
                  disabled={!hasPreviousEpisode}
                  className={hasPreviousEpisode ? BTN_CLASS : DISABLED_BTN_CLASS}
                  aria-label="Previous episode"
                  title="Previous Episode"
                >
                  <SkipBack size={ICON_SIZE} fill="currentColor" />
                </button>

                <button onClick={togglePlay} className={BTN_CLASS} aria-label={playing ? 'Pause' : 'Play'}>
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

                {/* ✅ NEW — volume control: click ya hover dono se vertical slider popup khulta hai */}
                <div
                  className="relative flex items-center"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                      setShowVolumeSlider((v) => !v);
                    }}
                    className={BTN_CLASS}
                    aria-label="Mute / Unmute"
                  >
                    <VolumeIcon size={ICON_SIZE} />
                  </button>

                  {showVolumeSlider && (
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl py-3 px-2 flex flex-col items-center z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[10px] text-white/70 mb-1 tabular-nums">
                        {muted ? 0 : volume}
                      </span>
                      <div
                        className="flex items-center justify-center"
                        style={{ height: 72, width: 20 }}
                      >
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={muted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="yt-progress-bar"
                          style={{
                            width: 64,
                            height: 4,
                            transform: 'rotate(-90deg)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <span className="whitespace-nowrap flex-shrink-0 text-white/70 text-xs px-1.5 tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center space-x-0.5 flex-shrink-0">
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSpeedMenu(!showSpeedMenu);
                    }}
                    className={BTN_CLASS}
                    aria-label="Playback speed"
                    title={`Speed: ${playbackRate}x`}
                  >
                    <Settings size={ICON_SIZE} />
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden min-w-[100px]">
                      {PLAYBACK_RATES.map((rate) => (
                        <button
                          key={rate}
                          onClick={(e) => {
                            e.stopPropagation();
                            changeSpeed(rate);
                          }}
                          className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 hover:bg-white/10 text-sm text-white/85"
                        >
                          {rate}x
                          {rate === playbackRate && <Check size={14} className="text-purple-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleFullscreen}
                  className={BTN_CLASS}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? <Minimize size={ICON_SIZE} /> : <Maximize size={ICON_SIZE} />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {!isCustom && (hasPreviousEpisode || hasNextEpisode) && (
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
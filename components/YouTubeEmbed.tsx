import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume1,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  RotateCcw,
  RotateCw,
  Repeat,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Zap,
  X,
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
  onPlayingChange?: (playing: boolean) => void;
}

type Timer = ReturnType<typeof setTimeout>;
type SkipSide = 'left' | 'right';
type Zone = SkipSide | 'center';

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SKIP_SECONDS = 10;
const KEY_SKIP_SECONDS = 5;
const DOUBLE_TAP_MS = 280;
const SKIP_INDICATOR_MS = 800;
const HOLD_BOOST_MS = 450;
const HUD_MS = 900;
const AUTO_NEXT_SECONDS = 5;
const RESUME_SAVE_INTERVAL_MS = 4000;
const RESUME_KEY_PREFIX = 'yt-resume:';
const PREFS_KEY = 'ytx-prefs';
const RING_LEN = 163.4; // 2 * PI * 26

const formatTime = (t: number) => {
  if (!isFinite(t) || t < 0) return '0:00';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ss = s < 10 ? `0${s}` : `${s}`;
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${ss}`;
  return `${m}:${ss}`;
};

const loadPrefs = (): { autoNext: boolean; loop: boolean } => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { autoNext: p.autoNext !== false, loop: !!p.loop };
    }
  } catch {}
  return { autoNext: true, loop: false };
};

const Switch: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    className={`relative inline-block w-8 h-[18px] rounded-full transition-colors duration-200 flex-shrink-0 ${
      on ? 'bg-purple-500' : 'bg-white/25'
    }`}
  >
    <span
      className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform duration-200 ${
        on ? 'translate-x-[14px]' : 'translate-x-0'
      }`}
    />
  </span>
);

const SeekIcon: React.FC<{ dir: 'back' | 'fwd'; size?: number }> = ({ dir, size = 22 }) => (
  <span className="relative flex items-center justify-center" style={{ width: size, height: size }}>
    {dir === 'back' ? <RotateCcw size={size} strokeWidth={1.8} /> : <RotateCw size={size} strokeWidth={1.8} />}
    <span className="absolute text-[7px] font-extrabold leading-none" style={{ marginTop: 1 }}>10</span>
  </span>
);

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  videoUrl,
  title,
  playerMode = 'custom',
  onNextEpisode,
  onPreviousEpisode,
  hasNextEpisode = false,
  hasPreviousEpisode = false,
  onPlayingChange,
}) => {
  const isCustom = playerMode === 'custom';

  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const hideTimeoutRef = useRef<Timer | null>(null);
  const listeningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const singleTapTimerRef = useRef<Timer | null>(null);
  const hudTimerRef = useRef<Timer | null>(null);
  const holdTimerRef = useRef<Timer | null>(null);

  // ---------- UI state ----------
  const [controlsVisible, setControlsVisible] = useState(true);
  const [nativeFs, setNativeFs] = useState(false);
  const [fakeFs, setFakeFs] = useState(false); // iPhone / unsupported browsers
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0); // 0..1
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [seeking, setSeeking] = useState(false);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<'main' | 'speed'>('main');

  const initialPrefs = useRef(loadPrefs()).current;
  const [autoNext, setAutoNext] = useState(initialPrefs.autoNext);
  const [loop, setLoop] = useState(initialPrefs.loop);

  const [ended, setEnded] = useState(false);
  const [endedCountdown, setEndedCountdown] = useState<number | null>(null);
  const [countdownCancelled, setCountdownCancelled] = useState(false);

  const [skipIndicator, setSkipIndicator] = useState<{ side: SkipSide; amount: number; key: number } | null>(null);
  const [hud, setHud] = useState<{ node: React.ReactNode; text: string; key: number } | null>(null);
  const [holdBoost, setHoldBoost] = useState(false);
  const [resumeToast, setResumeToast] = useState<number | null>(null);

  // ---------- refs mirroring state (no stale closures) ----------
  const playingRef = useRef(true);
  const endedRef = useRef(false);
  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const mutedRef = useRef(false);
  const volumeRef = useRef(100);
  const rateRef = useRef(1);
  const seekingRef = useRef(false);
  const loopRef = useRef(loop);
  const resumeAppliedRef = useRef(false);
  const hoverRef = useRef(false);
  const isTouchRef = useRef(false);
  const fakeFsRef = useRef(false);

  const lastTapRef = useRef<{ side: Zone; time: number } | null>(null);
  const skipStreakRef = useRef<{ side: SkipSide; amount: number; time: number } | null>(null);
  const holdActiveRef = useRef(false);
  const suppressClickRef = useRef(false);
  const prevRateRef = useRef(1);

  loopRef.current = loop;
  fakeFsRef.current = fakeFs;

  const youTubeId = getYouTubeId(videoUrl);
  const initialYouTubeIdRef = useRef(youTubeId);
  const isFirstLoadRef = useRef(true);

  const isFullscreen = nativeFs || fakeFs;

  // ---------- low level ----------
  const postCommand = (func: string, args: any[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
  };

  // YouTube ko batao ki hum listening mode me hain, tabhi wo infoDelivery bhejta hai
  const startListening = () => {
    if (listeningIntervalRef.current) clearInterval(listeningIntervalRef.current);
    let attempts = 0;
    listeningIntervalRef.current = setInterval(() => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: initialYouTubeIdRef.current }),
        '*'
      );
      attempts += 1;
      if (attempts >= 6 && listeningIntervalRef.current) {
        clearInterval(listeningIntervalRef.current);
      }
    }, 300);
  };

  const flash = (text: string, node?: React.ReactNode) => {
    setHud({ text, node, key: Date.now() });
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setHud(null), HUD_MS);
  };

  const showControlsTemporarily = () => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => setControlsVisible(false), 3000);
  };

  const closeMenus = () => {
    setShowSettings(false);
    setSettingsPanel('main');
  };

  const savePrefs = (next: { autoNext: boolean; loop: boolean }) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {}
  };

  // ---------- episode change ----------
  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      return;
    }
    if (youTubeId) {
      postCommand('loadVideoById', [youTubeId]);
      setPlaying(true);
      playingRef.current = true;
      setReady(false);
      setBuffering(false);
      setCurrentTime(0);
      setDuration(0);
      setBuffered(0);
      setEnded(false);
      endedRef.current = false;
      setCountdownCancelled(false);
      setResumeToast(null);
      currentTimeRef.current = 0;
      durationRef.current = 0;
      resumeAppliedRef.current = false;
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youTubeId]);

  // ---------- messages from YouTube ----------
  useEffect(() => {
    const handleState = (state: number) => {
      if (state === 1) {
        setPlaying(true);
        playingRef.current = true;
        setBuffering(false);
        setEnded(false);
        endedRef.current = false;
      } else if (state === 2) {
        setPlaying(false);
        playingRef.current = false;
        setBuffering(false);
      } else if (state === 3) {
        setBuffering(true);
      } else if (state === 0) {
        try {
          localStorage.removeItem(RESUME_KEY_PREFIX + youTubeId);
        } catch {}
        if (loopRef.current) {
          postCommand('seekTo', [0, true]);
          postCommand('playVideo');
          return;
        }
        setPlaying(false);
        playingRef.current = false;
        setBuffering(false);
        setEnded(true);
        endedRef.current = true;
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (data?.event === 'onStateChange' && typeof data.info === 'number') {
          handleState(data.info);
          return;
        }

        if ((data?.event === 'infoDelivery' || data?.event === 'initialDelivery') && data.info) {
          const info = data.info;
          setReady(true);

          if (typeof info.playerState === 'number') handleState(info.playerState);

          if (typeof info.currentTime === 'number') {
            currentTimeRef.current = info.currentTime;
            if (!seekingRef.current) setCurrentTime(info.currentTime);
          }
          if (typeof info.videoLoadedFraction === 'number') setBuffered(info.videoLoadedFraction);

          if (typeof info.duration === 'number' && info.duration > 0) {
            durationRef.current = info.duration;
            setDuration(info.duration);

            if (!resumeAppliedRef.current) {
              resumeAppliedRef.current = true;
              try {
                const saved = Number(localStorage.getItem(RESUME_KEY_PREFIX + youTubeId));
                if (saved > 5 && saved < info.duration - 10) {
                  postCommand('seekTo', [saved, true]);
                  setResumeToast(saved);
                }
              } catch {}
            }
          }
          if (typeof info.volume === 'number') {
            volumeRef.current = info.volume;
            setVolume(info.volume);
          }
          if (typeof info.muted === 'boolean') {
            mutedRef.current = info.muted;
            setMuted(info.muted);
          }
          if (typeof info.playbackRate === 'number') {
            rateRef.current = info.playbackRate;
            setPlaybackRate(info.playbackRate);
          }
        }
      } catch {
        // ignore unrelated messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youTubeId]);

  // spinner kabhi stuck na rahe
  useEffect(() => {
    const fallback = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(fallback);
  }, [youTubeId]);

  useEffect(() => {
    onPlayingChange?.(playing && ready);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, ready]);

  // ---------- resume save ----------
  useEffect(() => {
    if (!youTubeId) return;
    const save = () => {
      const t = currentTimeRef.current;
      if (t > 5 && !endedRef.current) {
        try {
          localStorage.setItem(RESUME_KEY_PREFIX + youTubeId, String(Math.floor(t)));
        } catch {}
      }
    };
    const id = setInterval(save, RESUME_SAVE_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    };
  }, [youTubeId]);

  useEffect(() => {
    if (resumeToast === null) return;
    const t = setTimeout(() => setResumeToast(null), 6000);
    return () => clearTimeout(t);
  }, [resumeToast]);

  // ---------- auto next countdown ----------
  useEffect(() => {
    if (!ended) {
      setCountdownCancelled(false);
      setEndedCountdown(null);
      return;
    }
    if (!hasNextEpisode || !autoNext || countdownCancelled) {
      setEndedCountdown(null);
      return;
    }
    setEndedCountdown(AUTO_NEXT_SECONDS);
    const id = setInterval(() => {
      setEndedCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [ended, hasNextEpisode, autoNext, countdownCancelled]);

  useEffect(() => {
    if (endedCountdown === 0) {
      setEnded(false);
      endedRef.current = false;
      onNextEpisode?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endedCountdown]);

  // ---------- fullscreen ----------
  useEffect(() => {
    const handleFullscreenChange = async () => {
      const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
      const now = !!fsElement;
      setNativeFs(now);
      if (now) {
        if (screen.orientation && 'lock' in screen.orientation && isTouchRef.current) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch {}
        }
      } else if (screen.orientation && 'unlock' in screen.orientation) {
        try {
          (screen.orientation as any).unlock();
        } catch {}
      }
    };
    const events = ['fullscreenchange', 'webkitfullscreenchange'];
    events.forEach((e) => document.addEventListener(e, handleFullscreenChange));
    return () => events.forEach((e) => document.removeEventListener(e, handleFullscreenChange));
  }, []);

  // sirf touch devices par rotate => auto fullscreen (desktop resize par nahi)
  useEffect(() => {
    isTouchRef.current = !!window.matchMedia?.('(pointer: coarse)').matches;
    const onRotate = () => {
      if (!isTouchRef.current || !playingRef.current) return;
      const isLandscape = window.innerWidth > window.innerHeight;
      const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (isLandscape && !fsElement && wrapperRef.current) {
        wrapperRef.current.requestFullscreen?.().catch(() => {});
      }
    };
    window.addEventListener('orientationchange', onRotate);
    return () => window.removeEventListener('orientationchange', onRotate);
  }, []);

  useEffect(() => {
    if (!fakeFs) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fakeFs]);

  // ---------- init / cleanup ----------
  useEffect(() => {
    showControlsTemporarily();
    return () => {
      [hideTimeoutRef, singleTapTimerRef, hudTimerRef, holdTimerRef].forEach((r) => {
        if (r.current) clearTimeout(r.current);
      });
      if (listeningIntervalRef.current) clearInterval(listeningIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    showControlsTemporarily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  useEffect(() => {
    if (!skipIndicator) return;
    const t = setTimeout(() => {
      setSkipIndicator(null);
      skipStreakRef.current = null;
    }, SKIP_INDICATOR_MS);
    return () => clearTimeout(t);
  }, [skipIndicator]);

  // ---------- actions ----------
  const seekTo = (time: number) => {
    const max = durationRef.current || Infinity;
    const target = Math.min(Math.max(time, 0), max);
    postCommand('seekTo', [target, true]);
    currentTimeRef.current = target;
    setCurrentTime(target);
    if (endedRef.current && target < max - 1) {
      setEnded(false);
      endedRef.current = false;
    }
    return target;
  };

  const skipBy = (delta: number) => {
    seekTo(currentTimeRef.current + delta);
    showControlsTemporarily();
  };

  const replay = () => {
    postCommand('seekTo', [0, true]);
    postCommand('playVideo');
    setEnded(false);
    endedRef.current = false;
    setPlaying(true);
    playingRef.current = true;
    currentTimeRef.current = 0;
    setCurrentTime(0);
  };

  const togglePlay = () => {
    if (!isCustom) return;
    if (endedRef.current) {
      replay();
      return;
    }
    if (playingRef.current) postCommand('pauseVideo');
    else postCommand('playVideo');
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
    showControlsTemporarily();
  };

  const toggleMute = () => {
    if (mutedRef.current) {
      postCommand('unMute');
      mutedRef.current = false;
      setMuted(false);
      flash(`${volumeRef.current}%`, <Volume2 size={18} />);
    } else {
      postCommand('mute');
      mutedRef.current = true;
      setMuted(true);
      flash('Muted', <VolumeX size={18} />);
    }
    showControlsTemporarily();
  };

  const applyVolume = (v: number, announce = false) => {
    const nv = Math.min(100, Math.max(0, Math.round(v)));
    postCommand('setVolume', [nv]);
    volumeRef.current = nv;
    setVolume(nv);
    if (nv === 0) {
      postCommand('mute');
      mutedRef.current = true;
      setMuted(true);
    } else if (mutedRef.current) {
      postCommand('unMute');
      mutedRef.current = false;
      setMuted(false);
    }
    if (announce) flash(`${nv}%`, nv === 0 ? <VolumeX size={18} /> : nv < 50 ? <Volume1 size={18} /> : <Volume2 size={18} />);
    showControlsTemporarily();
  };

  const changeSpeed = (rate: number, announce = true) => {
    postCommand('setPlaybackRate', [rate]);
    rateRef.current = rate;
    setPlaybackRate(rate);
    if (announce) flash(`${rate}x`, <Gauge size={18} />);
    showControlsTemporarily();
  };

  const stepSpeed = (dir: 1 | -1) => {
    const idx = PLAYBACK_RATES.findIndex((r) => r === rateRef.current);
    const next = PLAYBACK_RATES[Math.min(PLAYBACK_RATES.length - 1, Math.max(0, (idx === -1 ? 3 : idx) + dir))];
    changeSpeed(next);
  };

  const enterFullscreen = () => {
    const el = wrapperRef.current as any;
    if (!el) return;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      const p = req.call(el);
      if (p && typeof p.catch === 'function') p.catch(() => setFakeFs(true));
    } else {
      setFakeFs(true);
    }
  };

  const exitFullscreen = () => {
    if (fakeFsRef.current) setFakeFs(false);
    const d = document as any;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else if (d.webkitFullscreenElement) d.webkitExitFullscreen?.();
  };

  const toggleFullscreen = () => {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
    showControlsTemporarily();
  };

  const handleNextEpisode = () => {
    setEnded(false);
    endedRef.current = false;
    onNextEpisode?.();
    showControlsTemporarily();
  };

  const handlePreviousEpisode = () => {
    onPreviousEpisode?.();
    showControlsTemporarily();
  };

  const handleIframeLoad = () => {
    setReady(true);
    startListening();
  };

  // ---------- progress bar (pointer based) ----------
  const fracFromX = (clientX: number) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const onBarDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!durationRef.current) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    seekingRef.current = true;
    setSeeking(true);
    const f = fracFromX(e.clientX);
    setHoverFrac(f);
    setCurrentTime(f * durationRef.current);
  };
  const onBarMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const f = fracFromX(e.clientX);
    setHoverFrac(f);
    if (seekingRef.current) setCurrentTime(f * durationRef.current);
  };
  const onBarUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seekingRef.current) return;
    const f = fracFromX(e.clientX);
    seekTo(f * durationRef.current);
    seekingRef.current = false;
    setSeeking(false);
    if (!isTouchRef.current) setHoverFrac(f);
    else setHoverFrac(null);
    showControlsTemporarily();
  };
  const onBarLeave = () => {
    if (!seekingRef.current) setHoverFrac(null);
  };

  // ---------- tap zones ----------
  const doSkip = (side: SkipSide, now: number) => {
    skipBy(side === 'left' ? -SKIP_SECONDS : SKIP_SECONDS);
    const streak = skipStreakRef.current;
    const amount =
      streak && streak.side === side && now - streak.time < SKIP_INDICATOR_MS
        ? streak.amount + SKIP_SECONDS
        : SKIP_SECONDS;
    skipStreakRef.current = { side, amount, time: now };
    setSkipIndicator({ side, amount, key: now });
  };

  const singleTapAction = () => {
    if (isTouchRef.current) {
      if (!playingRef.current) {
        togglePlay();
      } else if (controlsVisible) {
        setControlsVisible(false);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      } else {
        showControlsTemporarily();
      }
    } else {
      togglePlay();
    }
  };

  const handleZoneTap = (side: Zone) => {
    if (suppressClickRef.current) return;
    wrapperRef.current?.focus({ preventScroll: true });
    if (showSettings) {
      closeMenus();
      return;
    }
    const now = Date.now();
    const last = lastTapRef.current;
    const streak = skipStreakRef.current;
    const inStreak =
      side !== 'center' && !!streak && streak.side === side && now - streak.time < SKIP_INDICATOR_MS;
    const isDouble = !!last && last.side === side && now - last.time < DOUBLE_TAP_MS;

    if (isDouble || inStreak) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = null;
      if (side === 'center') toggleFullscreen();
      else doSkip(side, now);
      return;
    }

    lastTapRef.current = { side, time: now };
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      singleTapAction();
    }, DOUBLE_TAP_MS);
  };

  // press & hold => 2x (YouTube Shorts style)
  const startHold = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (!playingRef.current) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      holdActiveRef.current = true;
      prevRateRef.current = rateRef.current;
      postCommand('setPlaybackRate', [2]);
      setHoldBoost(true);
    }, HOLD_BOOST_MS);
  };
  const endHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdActiveRef.current) {
      holdActiveRef.current = false;
      postCommand('setPlaybackRate', [prevRateRef.current]);
      setHoldBoost(false);
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 120);
    }
  };

  const zoneProps = (side: Zone) => ({
    onClick: () => handleZoneTap(side),
    onPointerDown: startHold,
    onPointerUp: endHold,
    onPointerLeave: endHold,
    onPointerCancel: endHold,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: { WebkitTouchCallout: 'none', touchAction: 'manipulation' } as React.CSSProperties,
  });

  // ---------- keyboard shortcuts ----------
  const latest = useRef<any>({});
  latest.current = {
    togglePlay,
    skipBy,
    seekTo,
    toggleMute,
    applyVolume,
    stepSpeed,
    toggleFullscreen,
    handleNextEpisode,
    handlePreviousEpisode,
    flash,
    hasNextEpisode,
    hasPreviousEpisode,
    exitFullscreen,
  };

  useEffect(() => {
    if (!isCustom) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return;
        if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const w = wrapperRef.current;
      const active =
        hoverRef.current ||
        (w && w.contains(document.activeElement)) ||
        !!document.fullscreenElement ||
        fakeFsRef.current;
      if (!active) return;

      const L = latest.current;
      let handled = true;
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          L.togglePlay();
          break;
        case 'ArrowLeft':
          L.skipBy(-KEY_SKIP_SECONDS);
          L.flash(`-${KEY_SKIP_SECONDS}s`, <RotateCcw size={18} />);
          break;
        case 'ArrowRight':
          L.skipBy(KEY_SKIP_SECONDS);
          L.flash(`+${KEY_SKIP_SECONDS}s`, <RotateCw size={18} />);
          break;
        case 'j':
        case 'J':
          L.skipBy(-SKIP_SECONDS);
          L.flash(`-${SKIP_SECONDS}s`, <RotateCcw size={18} />);
          break;
        case 'l':
        case 'L':
          L.skipBy(SKIP_SECONDS);
          L.flash(`+${SKIP_SECONDS}s`, <RotateCw size={18} />);
          break;
        case 'ArrowUp':
          L.applyVolume(volumeRef.current + 5, true);
          break;
        case 'ArrowDown':
          L.applyVolume(volumeRef.current - 5, true);
          break;
        case 'm':
        case 'M':
          L.toggleMute();
          break;
        case 'f':
        case 'F':
          L.toggleFullscreen();
          break;
        case 'Escape':
          if (fakeFsRef.current) L.exitFullscreen();
          else handled = false;
          break;
        case 'N':
          if (L.hasNextEpisode) L.handleNextEpisode();
          break;
        case 'P':
          if (L.hasPreviousEpisode) L.handlePreviousEpisode();
          break;
        case '>':
          L.stepSpeed(1);
          break;
        case '<':
          L.stepSpeed(-1);
          break;
        case 'Home':
          L.seekTo(0);
          break;
        case 'End':
          L.seekTo(durationRef.current);
          break;
        default:
          if (/^[0-9]$/.test(e.key) && durationRef.current) {
            L.seekTo((Number(e.key) / 10) * durationRef.current);
          } else {
            handled = false;
          }
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCustom]);

  // ---------- derived ----------
  if (!youTubeId) return null;

  const ICON_SIZE = 20;
  const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80';
  const BTN_CLASS = `ytx-btn ytx-tip flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white/85 hover:text-white hover:bg-white/15 hover:scale-110 active:scale-90 active:bg-white/25 transition-all duration-150 ${FOCUS}`;
  const DISABLED_BTN_CLASS =
    'flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white/20 cursor-not-allowed';
  const PLAY_BTN_CLASS = `ytx-btn ytx-tip flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 mx-0.5 rounded-full text-white bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-600/40 hover:shadow-pink-500/60 hover:scale-110 active:scale-90 transition-all duration-150 ${FOCUS}`;
  const GLASS =
    'flex items-center gap-0.5 p-1 rounded-full bg-black/40 backdrop-blur-md border border-white/15 shadow-lg shadow-black/30';
  const CIRCLE_BTN = `ytx-btn ytx-tip group flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full border text-white/90 hover:text-white shadow-lg shadow-black/30 hover:scale-110 active:scale-90 transition-all duration-200 ${FOCUS}`;
  const PILL_BTN = `inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur text-white text-sm font-semibold active:scale-95 transition-all ${FOCUS}`;

  const iframeParams = isCustom
    ? 'autoplay=1&rel=0&fs=0&controls=0&modestbranding=1&disablekb=1&iv_load_policy=3&playsinline=1&enablejsapi=1&color=white'
    : 'autoplay=1&rel=0&fs=1&playsinline=1&enablejsapi=1';

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const showUi = controlsVisible || !playing || seeking || showSettings || ended;
  const shownVolume = muted ? 0 : volume;
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPct = Math.min(100, buffered * 100);
  const hoverPct = hoverFrac === null ? 0 : Math.min(96, Math.max(4, hoverFrac * 100));
  const remaining = endedCountdown !== null && endedCountdown > 0 ? endedCountdown : null;

  return (
    <div
      ref={wrapperRef}
      tabIndex={isCustom ? 0 : -1}
      className={`ytx-root relative w-full bg-black overflow-hidden select-none outline-none ${
        fakeFs
          ? 'fixed inset-0 z-[9999] h-full rounded-none border-0'
          : 'aspect-video rounded-none border-0 sm:rounded-xl sm:border sm:border-purple-500/30 sm:shadow-[0_8px_40px_-12px_rgba(168,85,247,0.45)]'
      } ${isCustom && !showUi && playing ? 'cursor-none' : ''}`}
      onMouseMove={isCustom ? showControlsTemporarily : undefined}
      onMouseEnter={() => {
        hoverRef.current = true;
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        endHold();
      }}
    >
      <style>{`
        .ytx-bar { position: relative; height: 22px; display: flex; align-items: center; cursor: pointer; touch-action: none; }
        .ytx-track { position: relative; width: 100%; height: 4px; border-radius: 9999px; background: rgba(255,255,255,0.22); transition: height .15s ease; }
        .ytx-bar:hover .ytx-track, .ytx-bar.ytx-active .ytx-track { height: 7px; }
        .ytx-buf { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: rgba(255,255,255,0.3); transition: width .4s ease; }
        .ytx-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: linear-gradient(90deg, #a855f7, #ec4899); box-shadow: 0 0 10px rgba(236,72,153,.55); }
        .ytx-fill.ytx-smooth { transition: width .3s linear; }
        .ytx-thumb { position: absolute; top: 50%; width: 15px; height: 15px; margin: -7.5px 0 0 -7.5px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 4px rgba(168,85,247,.45); transform: scale(0); transition: transform .15s ease; }
        .ytx-bar:hover .ytx-thumb, .ytx-bar.ytx-active .ytx-thumb { transform: scale(1); }
        .ytx-hover-line { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: rgba(255,255,255,0.28); pointer-events: none; }

        input[type='range'].ytx-range { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 9999px; cursor: pointer; outline: none;
          background: linear-gradient(to right, #fff var(--v, 100%), rgba(255,255,255,0.25) var(--v, 100%)); }
        input[type='range'].ytx-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px rgba(168,85,247,.35); }
        input[type='range'].ytx-range::-moz-range-thumb { width: 12px; height: 12px; border: none; border-radius: 50%; background: #fff; }

        .ytx-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
        .ytx-noscroll::-webkit-scrollbar { display: none; width: 0; height: 0; }

        @keyframes ytxPop { 0% { opacity: 0; transform: translateY(8px) scale(.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes ytxFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ytxHud { 0% { opacity: 0; transform: translate(-50%, -6px) scale(.92); } 15% { opacity: 1; transform: translate(-50%, 0) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, 0) scale(.98); } }
        @keyframes ytxSkipBg { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes ytxChev { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
        @keyframes ytxPlayIn { 0% { opacity: 0; transform: scale(.6); } 60% { transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes ytxPulse { 0% { transform: scale(1); opacity: .5; } 100% { transform: scale(1.7); opacity: 0; } }
        @keyframes ytxRing { from { stroke-dashoffset: 0; } to { stroke-dashoffset: ${RING_LEN}; } }
        @keyframes ytxToast { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ytxBoost { 0%, 100% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.06); } }

        .ytx-pop { animation: ytxPop .18s ease-out both; transform-origin: bottom right; }
        .ytx-fadein { animation: ytxFade .25s ease-out both; }
        .ytx-hud { animation: ytxHud ${HUD_MS}ms ease-out forwards; }
        .ytx-skip-bg { animation: ytxSkipBg ${SKIP_INDICATOR_MS}ms ease-out forwards; }
        .ytx-chev { animation: ytxChev .8s ease-in-out infinite; }
        .ytx-playin { animation: ytxPlayIn .3s cubic-bezier(.2,.9,.3,1.2) both; }
        .ytx-pulse { animation: ytxPulse 1.6s ease-out infinite; }
        .ytx-ring { animation: ytxRing ${AUTO_NEXT_SECONDS}s linear forwards; }
        .ytx-toast { animation: ytxToast .3s ease-out both; }
        .ytx-boost { animation: ytxBoost 1s ease-in-out infinite; }

        @media (hover: hover) {
          .ytx-tip { position: relative; }
          .ytx-tip[data-tip]:not([aria-expanded='true']):hover::after {
            content: attr(data-tip); position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%);
            white-space: nowrap; padding: 4px 9px; border-radius: 8px; background: rgba(23,23,23,.96); border: 1px solid rgba(255,255,255,.12);
            color: #fff; font-size: 11px; font-weight: 500; line-height: 1.4; pointer-events: none; z-index: 60; animation: ytxFade .15s ease-out both;
          }
          .ytx-tip-start[data-tip]:hover::after { left: 0 !important; transform: none !important; }
          .ytx-tip-end[data-tip]:hover::after { left: auto !important; right: 0; transform: none !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ytx-root *, .ytx-root *::before, .ytx-root *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
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
          {/* Tap zones: left (double-tap -10s), center (play / double-tap fullscreen), right (+10s) */}
          <div className="absolute inset-0 bottom-20 z-10 flex">
            <div className="w-2/5 h-full" aria-label="Double tap to rewind 10 seconds" {...zoneProps('left')} />
            <div className="w-1/5 h-full" {...zoneProps('center')} />
            <div className="w-2/5 h-full" aria-label="Double tap to forward 10 seconds" {...zoneProps('right')} />
          </div>

          {/* Title bar */}
          <div
            className={`absolute top-0 left-0 right-0 z-20 px-4 pt-3 pb-8 bg-gradient-to-b from-black/70 to-transparent pointer-events-none transition-opacity duration-300 ${
              showUi ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {title && <p className="text-white text-sm sm:text-base font-medium truncate drop-shadow">{title}</p>}
          </div>

          {/* Loading / buffering */}
          {(!ready || buffering) && !ended && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 pointer-events-none ytx-fadein">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-white/15" />
                <div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 border-r-pink-400 animate-spin"
                />
              </div>
            </div>
          )}

          {/* Center play / pause button (clickable) */}
          {ready && !ended && !buffering && (!playing || (isTouchRef.current && showUi)) && (
            <div className="absolute inset-0 flex items-center justify-center z-[25] pointer-events-none">
              <button
                key={playing ? 'pause' : 'play'}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={playing ? 'Pause' : 'Play'}
                className="ytx-playin pointer-events-auto relative flex items-center justify-center hover:scale-110 active:scale-90 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-full"
                style={{ width: 72, height: 72 }}
              >
                {!playing && <span className="ytx-pulse absolute inset-0 rounded-full bg-pink-400/40" />}
                <span className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border border-white/30 shadow-[0_0_40px_rgba(236,72,153,0.55)]">
                  {playing ? (
                    <Pause size={30} className="text-white" fill="white" />
                  ) : (
                    <Play size={30} className="text-white ml-1" fill="white" />
                  )}
                </span>
              </button>
            </div>
          )}

          {/* 2x hold badge */}
          {holdBoost && (
            <div className="ytx-boost absolute top-4 left-1/2 z-30 flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-sm border border-white/15 px-3 py-1.5 text-white text-xs font-semibold pointer-events-none">
              <Zap size={14} className="text-yellow-300" fill="currentColor" />
              2x speed
            </div>
          )}

          {/* HUD (volume / speed / seek feedback) */}
          {hud && (
            <div
              key={hud.key}
              className="ytx-hud absolute top-6 left-1/2 z-30 flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-md border border-white/10 px-4 py-2 text-white text-sm font-medium pointer-events-none"
            >
              {hud.node}
              <span className="tabular-nums">{hud.text}</span>
            </div>
          )}

          {/* Double-tap skip indicator */}
          {skipIndicator && (
            <div
              key={skipIndicator.key}
              className={`absolute top-0 bottom-20 z-20 w-2/5 flex items-center justify-center pointer-events-none ${
                skipIndicator.side === 'left' ? 'left-0' : 'right-0'
              }`}
            >
              <div
                className="ytx-skip-bg absolute inset-0 bg-white/15"
                style={{
                  borderRadius:
                    skipIndicator.side === 'left' ? '0 60% 60% 0 / 0 50% 50% 0' : '60% 0 0 60% / 50% 0 0 50%',
                }}
              />
              <div className="ytx-skip-bg relative flex flex-col items-center gap-1 text-white">
                <div className="flex items-center">
                  {(skipIndicator.side === 'left' ? [2, 1, 0] : [0, 1, 2]).map((i) => (
                    <span key={i} className="ytx-chev" style={{ animationDelay: `${i * 0.12}s` }}>
                      {skipIndicator.side === 'left' ? (
                        <ChevronLeft size={26} strokeWidth={3} className="-mx-1.5" />
                      ) : (
                        <ChevronRight size={26} strokeWidth={3} className="-mx-1.5" />
                      )}
                    </span>
                  ))}
                </div>
                <span className="text-xs font-semibold whitespace-nowrap">{skipIndicator.amount} seconds</span>
              </div>
            </div>
          )}

          {/* Resume toast */}
          {resumeToast !== null && !ended && (
            <div className="ytx-toast absolute left-3 bottom-24 z-40 flex items-center gap-3 rounded-xl bg-neutral-900/95 backdrop-blur border border-white/10 pl-4 pr-2 py-2 text-white text-xs sm:text-sm shadow-xl">
              <span>
                Resumed from <b className="tabular-nums">{formatTime(resumeToast)}</b>
              </span>
              <button
                onClick={() => {
                  seekTo(0);
                  setResumeToast(null);
                }}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold hover:brightness-110 active:scale-95 transition-all"
              >
                Start over
              </button>
              <button
                onClick={() => setResumeToast(null)}
                aria-label="Dismiss"
                className="flex items-center justify-center w-7 h-7 rounded-full text-white/60 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Ended overlay */}
          {ended && (
            <div className="ytx-fadein absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/75 backdrop-blur-sm px-4 text-center">
              {hasNextEpisode ? (
                <>
                  <p className="text-white/70 text-xs sm:text-sm">
                    {remaining !== null ? `Next episode starts in ${remaining}s` : 'Up next'}
                  </p>
                  <button
                    onClick={handleNextEpisode}
                    className={`group relative flex items-center justify-center w-[76px] h-[76px] rounded-full bg-gradient-to-br from-purple-600/60 to-pink-600/60 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 hover:scale-105 active:scale-95 transition-all ${FOCUS}`}
                    aria-label="Play next episode"
                  >
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                      {remaining !== null && (
                        <circle
                          key={`ring-${youTubeId}-${ended}`}
                          className="ytx-ring"
                          cx="30"
                          cy="30"
                          r="26"
                          fill="none"
                          stroke="url(#ytxGrad)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={RING_LEN}
                        />
                      )}
                      <defs>
                        <linearGradient id="ytxGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#a855f7" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <SkipForward size={26} className="text-white" fill="white" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={replay}
                      className={PILL_BTN}
                    >
                      <RotateCcw size={15} /> Replay
                    </button>
                    {remaining !== null && (
                      <button
                        onClick={() => setCountdownCancelled(true)}
                        className={PILL_BTN}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <button
                  onClick={replay}
                  className="ytx-playin flex flex-col items-center gap-2 text-white"
                  aria-label="Replay video"
                >
                  <span className="flex items-center justify-center w-[76px] h-[76px] rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-[0_0_36px_rgba(236,72,153,0.5)] border border-white/30 hover:scale-105 active:scale-95 transition-transform">
                    <RotateCcw size={28} />
                  </span>
                  <span className="text-sm font-medium">Replay</span>
                </button>
              )}
            </div>
          )}

          {/* Control bar */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 sm:px-3 pt-8 pb-2 text-white z-30 transition-all duration-300 ${
              showUi ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
          >
            {/* Progress bar */}
            <div
              ref={barRef}
              className={`ytx-bar mx-1 ${seeking ? 'ytx-active' : ''}`}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.floor(duration)}
              aria-valuenow={Math.floor(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              onPointerDown={onBarDown}
              onPointerMove={onBarMove}
              onPointerUp={onBarUp}
              onPointerCancel={onBarUp}
              onPointerLeave={onBarLeave}
              onClick={(e) => e.stopPropagation()}
            >
              {hoverFrac !== null && duration > 0 && (
                <div
                  className="absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-neutral-900/95 border border-white/10 px-2 py-1 text-[11px] tabular-nums text-white pointer-events-none shadow-lg"
                  style={{ left: `${hoverPct}%` }}
                >
                  {formatTime(hoverFrac * duration)}
                </div>
              )}
              <div className="ytx-track">
                <div className="ytx-buf" style={{ width: `${bufferedPct}%` }} />
                {hoverFrac !== null && !seeking && (
                  <div className="ytx-hover-line" style={{ width: `${hoverFrac * 100}%` }} />
                )}
                <div className={`ytx-fill ${seeking ? '' : 'ytx-smooth'}`} style={{ width: `${progressPct}%` }} />
                <div className="ytx-thumb" style={{ left: `${progressPct}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
               <div className={GLASS}>
                <button
                  onClick={handlePreviousEpisode}
                  disabled={!hasPreviousEpisode}
                  className={hasPreviousEpisode ? `${BTN_CLASS} ytx-tip-start` : DISABLED_BTN_CLASS}
                  aria-label="Previous episode"
                  data-tip="Previous episode (Shift+P)"
                >
                  <SkipBack size={ICON_SIZE} fill="currentColor" />
                </button>

                <button
                  onClick={togglePlay}
                  className={PLAY_BTN_CLASS}
                  aria-label={playing ? 'Pause' : 'Play'}
                  data-tip={playing ? 'Pause (k)' : 'Play (k)'}
                >
                  {playing ? <Pause size={ICON_SIZE} fill="currentColor" /> : <Play size={ICON_SIZE} fill="currentColor" className="ml-0.5" />}
                </button>

                <button
                  onClick={handleNextEpisode}
                  disabled={!hasNextEpisode}
                  className={
                    hasNextEpisode
                      ? `ytx-btn ytx-tip group flex items-center gap-1.5 h-9 sm:h-10 pl-3 pr-3 sm:pr-4 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-semibold hover:scale-105 active:scale-95 transition-all duration-200 ${FOCUS}`
                      : 'flex items-center gap-1.5 h-9 sm:h-10 pl-3 pr-3 sm:pr-4 rounded-full text-white/20 text-xs font-semibold cursor-not-allowed'
                  }
                  aria-label="Next episode"
                  data-tip="Next episode (Shift+N)"
                >
                  <span className="hidden sm:inline">Next</span>
                  <SkipForward
                    size={ICON_SIZE - 2}
                    fill="currentColor"
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </button>
               </div>

                {/* Volume: hover par slider smoothly expand hota hai */}
                <div className={`group hidden sm:flex ${GLASS}`}>
                  <button onClick={toggleMute} className={BTN_CLASS} aria-label="Mute / Unmute" data-tip="Mute (m)">
                    <VolumeIcon size={ICON_SIZE} />
                  </button>
                  <div className="hidden sm:flex items-center w-0 overflow-hidden transition-all duration-200 group-hover:w-[76px] group-focus-within:w-[76px] group-hover:mr-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={shownVolume}
                      onChange={(e) => applyVolume(Number(e.target.value))}
                      className="ytx-range w-[68px]"
                      style={{ ['--v' as any]: `${shownVolume}%` }}
                      aria-label="Volume"
                    />
                  </div>
                </div>

                <span className="whitespace-nowrap flex-shrink-0 text-white/90 text-[11px] sm:text-xs font-medium px-2.5 py-1 ml-1 rounded-full bg-white/10 border border-white/10 tabular-nums">
                  {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`hidden sm:flex ${GLASS}`}>
                <button
                  onClick={() => skipBy(-SKIP_SECONDS)}
                  className={BTN_CLASS}
                  aria-label="Rewind 10 seconds"
                  data-tip="Back 10s (j)"
                >
                  <SeekIcon dir="back" />
                </button>
                <button
                  onClick={() => skipBy(SKIP_SECONDS)}
                  className={BTN_CLASS}
                  aria-label="Forward 10 seconds"
                  data-tip="Forward 10s (l)"
                >
                  <SeekIcon dir="fwd" />
                </button>
                </div>

                {loop && (
                  <span
                    className="hidden sm:flex items-center justify-center w-7 h-7 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30"
                    aria-label="Loop on"
                  >
                    <Repeat size={13} />
                  </span>
                )}
                {playbackRate !== 1 && (
                  <button
                    onClick={() => changeSpeed(1)}
                    className={`ytx-tip ytx-tip-end h-7 px-2.5 mr-0.5 rounded-full bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-400/40 hover:from-purple-500/50 hover:to-pink-500/50 text-[11px] font-bold tabular-nums active:scale-95 transition-all ${FOCUS}`}
                    data-tip="Reset speed"
                    aria-label="Reset speed"
                  >
                    {playbackRate}x
                  </button>
                )}

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSettingsPanel('main');
                      setShowSettings((v) => !v);
                    }}
                    className={`${CIRCLE_BTN} ytx-tip-end ${
                      showSettings
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 border-white/30 shadow-purple-600/50'
                        : 'bg-black/40 backdrop-blur-md border-white/15 hover:bg-white/20 hover:border-white/30'
                    }`}
                    aria-label="Settings"
                    aria-expanded={showSettings}
                    data-tip="Settings"
                  >
                    <Settings
                      size={ICON_SIZE}
                      className={`transition-transform duration-500 ${showSettings ? 'rotate-90' : 'group-hover:rotate-45'}`}
                    />
                  </button>

                </div>

                <button
                  onClick={toggleFullscreen}
                  className={`${CIRCLE_BTN} ytx-tip-end bg-black/40 backdrop-blur-md border-white/15 hover:bg-white/20 hover:border-white/30`}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  data-tip={isFullscreen ? 'Exit fullscreen (f)' : 'Fullscreen (f)'}
                >
                  {isFullscreen ? (
                    <Minimize size={ICON_SIZE} className="transition-transform duration-200 group-hover:scale-90" />
                  ) : (
                    <Maximize size={ICON_SIZE} className="transition-transform duration-200 group-hover:scale-110" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Settings menu: player root ke andar, taaki phone par bhi poora dikhe aur scroll ho */}
          {showSettings && (
            <div
              className="ytx-pop ytx-noscroll absolute right-2 sm:right-3 bottom-[4rem] z-50 w-60 max-w-[calc(100%-1rem)] max-h-[calc(100%-4.75rem)] overflow-y-auto overscroll-contain rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60 text-white"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={showControlsTemporarily}
            >
              {settingsPanel === 'main' ? (
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => setSettingsPanel('speed')}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm hover:bg-white/10 active:scale-[.98] transition-all ${FOCUS}`}
                  >
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white/80">
                      <Gauge size={16} />
                    </span>
                    <span className="flex-1 text-left font-medium">Playback speed</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-semibold text-white/80">
                      {playbackRate === 1 ? 'Normal' : `${playbackRate}x`}
                    </span>
                    <ChevronRight size={14} className="text-white/40" />
                  </button>
                  <button
                    onClick={() => {
                      const next = !autoNext;
                      setAutoNext(next);
                      savePrefs({ autoNext: next, loop });
                    }}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm hover:bg-white/10 active:scale-[.98] transition-all ${FOCUS}`}
                  >
                    <span
                      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                        autoNext ? 'bg-purple-500/25 text-purple-300' : 'bg-white/10 text-white/70'
                      }`}
                    >
                      <SkipForward size={16} />
                    </span>
                    <span className="flex-1 text-left font-medium">Auto-play next</span>
                    <Switch on={autoNext} />
                  </button>
                  <button
                    onClick={() => {
                      const next = !loop;
                      setLoop(next);
                      savePrefs({ autoNext, loop: next });
                    }}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm hover:bg-white/10 active:scale-[.98] transition-all ${FOCUS}`}
                  >
                    <span
                      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                        loop ? 'bg-purple-500/25 text-purple-300' : 'bg-white/10 text-white/70'
                      }`}
                    >
                      <Repeat size={16} />
                    </span>
                    <span className="flex-1 text-left font-medium">Loop video</span>
                    <Switch on={loop} />
                  </button>
                </div>
              ) : (
                <div className="p-1.5">
                  <button
                    onClick={() => setSettingsPanel('main')}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sm font-semibold hover:bg-white/10 active:scale-[.98] transition-all ${FOCUS}`}
                  >
                    <ChevronLeft size={18} />
                    Playback speed
                  </button>
                  <div className="grid grid-cols-4 gap-1.5 px-1 pt-1.5 pb-1">
                    {PLAYBACK_RATES.map((rate) => {
                      const on = rate === playbackRate;
                      return (
                        <button
                          key={rate}
                          onClick={() => {
                            changeSpeed(rate, false);
                            closeMenus();
                          }}
                          aria-pressed={on}
                          className={`h-9 rounded-lg text-xs font-bold tabular-nums active:scale-90 transition-all ${FOCUS} ${
                            on
                              ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-purple-600/40'
                              : 'bg-white/10 hover:bg-white/20 text-white/85'
                          }`}
                        >
                          {rate}x
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
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
              data-tip="Previous Episode"
            >
              <SkipBack size={ICON_SIZE} fill="currentColor" />
            </button>
            <button
              onClick={handleNextEpisode}
              disabled={!hasNextEpisode}
              className={hasNextEpisode ? BTN_CLASS : DISABLED_BTN_CLASS}
              aria-label="Next episode"
              data-tip="Next Episode"
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
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
  Check,
  PictureInPicture2,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  qualities?: { label: string; src: string }[];
  poster?: string;
  title?: string;
  episode?: number | string;
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
const SKIP_SECONDS = 15;
const KEY_SKIP_SECONDS = 15;
const MAX_SKIP = 120;
const VOLUME_KEY_STEP = 10;
const DOUBLE_TAP_MS = 280;
const SKIP_INDICATOR_MS = 800;
const HOLD_BOOST_MS = 450;
const HUD_MS = 900;
const AUTO_NEXT_SECONDS = 5;
const RESUME_SAVE_INTERVAL_MS = 4000;
const PROGRESS_KEY_PREFIX = 'video-progress-';
const PREFS_KEY = 'ytx-prefs'; // YouTube player ke saath same prefs (auto-next / loop)
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
    <span className="absolute text-[7px] font-extrabold leading-none" style={{ marginTop: 1 }}>{SKIP_SECONDS}</span>
  </span>
);

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  qualities,
  poster,
  title,
  episode,
  onNextEpisode,
  onPreviousEpisode,
  hasNextEpisode = false,
  hasPreviousEpisode = false,
  onPlayingChange,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const hideTimeoutRef = useRef<Timer | null>(null);
  const singleTapTimerRef = useRef<Timer | null>(null);
  const hudTimerRef = useRef<Timer | null>(null);
  const holdTimerRef = useRef<Timer | null>(null);

  // ---------- UI state ----------
  const [currentSrc, setCurrentSrc] = useState(src);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [nativeFs, setNativeFs] = useState(false);
  const [fakeFs, setFakeFs] = useState(false); // iPhone / unsupported browsers
  const [playing, setPlaying] = useState(false);
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
  const [settingsPanel, setSettingsPanel] = useState<'main' | 'speed' | 'quality'>('main');
  const [autoQuality, setAutoQuality] = useState(true);

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
  const [showFullTitle, setShowFullTitle] = useState(false);

  // zoom / pan / brightness
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(1);
  const scaleRef = useRef(1);
  const targetScaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const brightnessRef = useRef(1);
  const rafRef = useRef<number | null>(null);

  // ---------- refs mirroring state ----------
  const playingRef = useRef(false);
  const endedRef = useRef(false);
  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const seekingRef = useRef(false);
  const hoverRef = useRef(false);
  const isTouchRef = useRef(false);
  const fakeFsRef = useRef(false);
  const rateRef = useRef(1);
  const volumeRef = useRef(100);
  const mutedRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingPlayRef = useRef<boolean | null>(null);
  const fullscreenStatePushed = useRef(false);

  const lastTapRef = useRef<{ side: Zone; time: number } | null>(null);
  const skipStreakRef = useRef<{ side: SkipSide; amount: number; time: number } | null>(null);
  const holdActiveRef = useRef(false);
  const suppressClickRef = useRef(false);
  const prevRateRef = useRef(1);
  const titleTimeoutRef = useRef<Timer | null>(null);

  fakeFsRef.current = fakeFs;
  const isFullscreen = nativeFs || fakeFs;

  // base src (episode) ke hisaab se resume key, quality change par same rahe
  const progressKey = `${PROGRESS_KEY_PREFIX}${src}`;
  const progressKeyRef = useRef(progressKey);
  progressKeyRef.current = progressKey;

  // ---------- low level helpers ----------
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

  // ---------- src / episode change ----------
  useEffect(() => {
    // naya episode: sab reset
    setCurrentSrc(src);
    pendingSeekRef.current = null;
    pendingPlayRef.current = null;
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
  }, [src]);

  useEffect(() => {
    onPlayingChange?.(playing && !buffering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, buffering]);

  // spinner kabhi stuck na rahe
  useEffect(() => {
    const fallback = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(fallback);
  }, [currentSrc]);

  // ---------- video element events ----------
  const updateBuffered = () => {
    const v = videoRef.current;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    const t = v.currentTime;
    let end = 0;
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.buffered.start(i) <= t + 0.5 && v.buffered.end(i) >= end) end = v.buffered.end(i);
    }
    setBuffered(Math.min(1, end / v.duration));
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    currentTimeRef.current = v.currentTime;
    if (!seekingRef.current) setCurrentTime(v.currentTime);
    updateBuffered();
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setReady(true);
    if (isFinite(v.duration)) {
      durationRef.current = v.duration;
      setDuration(v.duration);
    }

    // quality change ke baad same jagah se
    if (pendingSeekRef.current !== null) {
      v.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
      if (pendingPlayRef.current === false) v.pause();
      pendingPlayRef.current = null;
      return;
    }

    // resume
    try {
      const saved = Number(localStorage.getItem(progressKeyRef.current));
      if (saved > 5 && saved < v.duration - 10) {
        v.currentTime = saved;
        setResumeToast(saved);
      }
    } catch {}
  };

  const handleEnded = () => {
    try {
      localStorage.removeItem(progressKeyRef.current);
    } catch {}
    setPlaying(false);
    playingRef.current = false;
    setBuffering(false);
    setEnded(true);
    endedRef.current = true;
  };

  // ---------- resume save ----------
  useEffect(() => {
    const save = () => {
      const t = currentTimeRef.current;
      if (t > 5 && !endedRef.current) {
        try {
          localStorage.setItem(progressKeyRef.current, String(Math.floor(t)));
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
  }, []);

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
      const d = document as any;
      const fsElement = document.fullscreenElement || d.webkitFullscreenElement;
      const now = fsElement === wrapperRef.current;
      setNativeFs(now);
      if (now) {
        if (!fullscreenStatePushed.current) {
          window.history.pushState({ fullscreen: true }, '');
          fullscreenStatePushed.current = true;
        }
        if (screen.orientation && 'lock' in screen.orientation && isTouchRef.current) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch {}
        }
      } else {
        if (fullscreenStatePushed.current) {
          window.history.replaceState({}, '');
          fullscreenStatePushed.current = false;
        }
        resetZoom();
        if (screen.orientation && 'unlock' in screen.orientation) {
          try {
            (screen.orientation as any).unlock();
          } catch {}
        }
      }
    };
    const events = ['fullscreenchange', 'webkitfullscreenchange'];
    events.forEach((e) => document.addEventListener(e, handleFullscreenChange));
    return () => events.forEach((e) => document.removeEventListener(e, handleFullscreenChange));
  }, []);

  // back button se fullscreen band
  useEffect(() => {
    const onPop = () => {
      if (document.fullscreenElement === wrapperRef.current) {
        document.exitFullscreen?.().catch(() => {});
        fullscreenStatePushed.current = false;
      } else if (fakeFsRef.current) {
        setFakeFs(false);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // touch device detect
  useEffect(() => {
    isTouchRef.current = !!window.matchMedia?.('(pointer: coarse)').matches;
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
      [hideTimeoutRef, singleTapTimerRef, hudTimerRef, holdTimerRef, titleTimeoutRef].forEach((r) => {
        if (r.current) clearTimeout(r.current);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const v = videoRef.current;
    const max = durationRef.current || Infinity;
    const target = Math.min(Math.max(time, 0), max);
    if (v) v.currentTime = target;
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
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
    setEnded(false);
    endedRef.current = false;
    currentTimeRef.current = 0;
    setCurrentTime(0);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (endedRef.current) {
      replay();
      return;
    }
    if (v.paused) v.play().catch((err) => console.error('Play failed:', err));
    else v.pause();
    showControlsTemporarily();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted || v.volume === 0) {
      v.muted = false;
      if (v.volume === 0) v.volume = 0.5;
      flash(`${Math.round(v.volume * 100)}%`, <Volume2 size={18} />);
    } else {
      v.muted = true;
      flash('Muted', <VolumeX size={18} />);
    }
    showControlsTemporarily();
  };

  const applyVolume = (val: number, announce = false) => {
    const v = videoRef.current;
    const nv = Math.min(100, Math.max(0, Math.round(val)));
    if (v) {
      v.volume = nv / 100;
      v.muted = nv === 0;
    }
    volumeRef.current = nv;
    setVolume(nv);
    if (announce) {
      flash(`${nv}%`, nv === 0 ? <VolumeX size={18} /> : nv < 50 ? <Volume1 size={18} /> : <Volume2 size={18} />);
    }
    showControlsTemporarily();
  };

  const changeSpeed = (rate: number, announce = true) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
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

  const togglePiP = async () => {
    const v = videoRef.current as any;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch (err) {
      console.error('PiP failed:', err);
    }
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

  // ---------- quality ----------
  const selectQuality = (newSrc: string) => {
    if (newSrc === currentSrc) return;
    pendingSeekRef.current = currentTimeRef.current;
    pendingPlayRef.current = playingRef.current || currentTimeRef.current < 1;
    setReady(false);
    setCurrentSrc(newSrc);
  };

  const detectAutoQuality = () => {
    if (!qualities || qualities.length === 0) return;
    const connection = (navigator as any).connection;
    if (!connection) return;
    const downlink = connection.downlink;
    let selected = qualities[0];
    if (downlink > 5 && qualities.length >= 3) selected = qualities[2];
    else if (downlink > 2 && qualities.length >= 2) selected = qualities[1];
    selectQuality(selected.src);
  };
  const detectRef = useRef(detectAutoQuality);
  detectRef.current = detectAutoQuality;

  useEffect(() => {
    if (!autoQuality) return;
    detectRef.current();
    const connection = (navigator as any).connection;
    const handler = () => detectRef.current();
    if (connection) connection.addEventListener('change', handler);
    return () => {
      if (connection) connection.removeEventListener('change', handler);
    };
  }, [qualities, autoQuality, src]);

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

  // ---------- zoom helpers ----------
  const resetZoom = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    scaleRef.current = 1;
    targetScaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const clampTranslate = (x: number, y: number) => {
    const el = wrapperRef.current;
    const sc = scaleRef.current;
    if (!el || sc <= 1) return { x: 0, y: 0 };
    const maxX = (el.clientWidth * (sc - 1)) / 2;
    const maxY = (el.clientHeight * (sc - 1)) / 2;
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  };

  const animateScale = () => {
    const diff = targetScaleRef.current - scaleRef.current;
    if (Math.abs(diff) < 0.002) {
      scaleRef.current = targetScaleRef.current;
      setScale(scaleRef.current);
      rafRef.current = null;
    } else {
      scaleRef.current += diff * 0.25;
      setScale(scaleRef.current);
      rafRef.current = requestAnimationFrame(animateScale);
    }
    const c = clampTranslate(translateRef.current.x, translateRef.current.y);
    translateRef.current = c;
    setTranslate(c);
  };

  // ---------- tap zones ----------
  const doSkip = (side: SkipSide, now: number) => {
    skipBy(side === 'left' ? -SKIP_SECONDS : SKIP_SECONDS);
    const streak = skipStreakRef.current;
    const amount =
      streak && streak.side === side && now - streak.time < SKIP_INDICATOR_MS
        ? Math.min(streak.amount + SKIP_SECONDS, MAX_SKIP)
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

    // Desktop: center click = seedha play/pause (fast click safe)
    if (side === 'center' && !isTouchRef.current) {
      lastTapRef.current = null;
      togglePlay();
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
      // desktop par pehla click play/pause kar chuka hai, wo undo karo
      if (isDouble && !isTouchRef.current) togglePlay();
      if (side === 'center') {
        if (scaleRef.current !== 1) {
          resetZoom();
          flash('Zoom reset', <Maximize size={18} />);
        } else toggleFullscreen();
      } else doSkip(side, now);
      return;
    }

    lastTapRef.current = { side, time: now };

    // Instant: desktop, ya paused video par center tap
    if (!isTouchRef.current || (side === 'center' && !playingRef.current)) {
      singleTapAction();
      return;
    }

    // Touch par double-tap ke liye thoda wait
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      singleTapAction();
    }, DOUBLE_TAP_MS);
  };

  // press & hold => 2x
  const startHold = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (!playingRef.current) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      holdActiveRef.current = true;
      prevRateRef.current = rateRef.current;
      if (videoRef.current) videoRef.current.playbackRate = 2;
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
      if (videoRef.current) videoRef.current.playbackRate = prevRateRef.current;
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
    style: { WebkitTouchCallout: 'none', touchAction: 'none' } as React.CSSProperties,
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
          L.applyVolume(volumeRef.current + VOLUME_KEY_STEP, true);
          break;
        case 'ArrowDown':
          L.applyVolume(volumeRef.current - VOLUME_KEY_STEP, true);
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
  }, []);

  // ---------- touch gestures: pinch zoom, pan, brightness / volume swipe ----------
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const g = {
      ignore: false,
      pinched: false,
      moved: false,
      swipe: false,
      vertical: false,
      dragging: false,
      side: 'left' as 'left' | 'right',
      startX: 0,
      startY: 0,
      lastY: 0,
      dragX: 0,
      dragY: 0,
      vol: 0,
      pinchDist: 0,
    };
    const dist = (e: TouchEvent) =>
      Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const cancelTaps = () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      lastTapRef.current = null;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        g.ignore = !!(e.target as HTMLElement | null)?.closest('[data-ui]');
        g.pinched = false;
        g.moved = false;
        g.swipe = false;
        g.vertical = false;
      }
      if (g.ignore) return;
      if (e.touches.length >= 2) {
        g.pinched = true;
        g.moved = true;
        cancelTaps();
        g.pinchDist = dist(e);
        return;
      }
      const t = e.touches[0];
      const r = el.getBoundingClientRect();
      g.startX = t.clientX;
      g.startY = t.clientY;
      g.lastY = t.clientY;
      g.side = t.clientX - r.left < r.width / 2 ? 'left' : 'right';
      g.vol = volumeRef.current;
      if (scaleRef.current > 1) {
        g.dragging = true;
        g.dragX = t.clientX - translateRef.current.x;
        g.dragY = t.clientY - translateRef.current.y;
      } else {
        g.dragging = false;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (g.ignore) return;
      if (e.touches.length >= 2) {
        e.preventDefault();
        const d = dist(e);
        if (g.pinchDist) {
          targetScaleRef.current = Math.min(3, Math.max(0.5, targetScaleRef.current * (d / g.pinchDist)));
          if (!rafRef.current) rafRef.current = requestAnimationFrame(animateScale);
        }
        g.pinchDist = d;
        g.pinched = true;
        g.moved = true;
        return;
      }
      if (g.pinched) return;
      const t = e.touches[0];

      // zoom ke baad drag (pan)
      if (g.dragging && scaleRef.current > 1) {
        e.preventDefault();
        if (Math.hypot(t.clientX - g.startX, t.clientY - g.startY) > 10) {
          g.moved = true;
          cancelTaps();
        }
        const c = clampTranslate(t.clientX - g.dragX, t.clientY - g.dragY);
        translateRef.current = c;
        setTranslate(c);
        return;
      }

      if (!g.swipe) {
        const dx = Math.abs(t.clientX - g.startX);
        const dy = Math.abs(t.clientY - g.startY);
        if (dx > 10 || dy > 10) {
          g.swipe = true;
          g.moved = true;
          g.vertical = dy > dx;
          cancelTaps();
        }
      }

      if (g.swipe && g.vertical) {
        e.preventDefault();
        const deltaY = g.lastY - t.clientY;
        g.lastY = t.clientY;
        const L = latest.current;
        if (g.side === 'left') {
          const b = Math.max(0.3, Math.min(2, brightnessRef.current + deltaY / 500));
          brightnessRef.current = b;
          setBrightness(b);
          L.flash(`${Math.round(b * 100)}%`, <Sun size={18} />);
        } else {
          g.vol = Math.min(100, Math.max(0, g.vol + deltaY / 5));
          L.applyVolume(g.vol, true);
        }
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (g.moved) {
          suppressClickRef.current = true;
          setTimeout(() => {
            suppressClickRef.current = false;
          }, 250);
        }
        g.ignore = false;
        g.pinched = false;
        g.moved = false;
        g.swipe = false;
        g.vertical = false;
        g.dragging = false;
        g.pinchDist = 0;
      } else if (g.pinched) {
        g.pinchDist = 0;
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- title ----------
  const animeTitle = title || '';
  const hasEpisode = episode !== undefined && episode !== null && episode !== '';
  const episodeStr = hasEpisode ? ` Ep ${episode}` : '';
  const fullTitle = `${animeTitle}${episodeStr}`;
  const MAX_TITLE_LEN = 30;
  const isTitleTruncated = animeTitle.length > MAX_TITLE_LEN;
  const truncatedTitle = `${isTitleTruncated ? animeTitle.slice(0, MAX_TITLE_LEN) + '...' : animeTitle}${episodeStr}`;
  const displayedTitle = showFullTitle ? fullTitle : truncatedTitle;

  const handleTitleClick = () => {
    if (!isTitleTruncated) return;
    setShowFullTitle(true);
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => setShowFullTitle(false), 3000);
  };

  // ---------- derived ----------
  const ICON_SIZE = 20;
  const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80';
  const BTN_CLASS = `ytx-btn ytx-tip flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white/85 hover:text-white hover:bg-white/15 hover:scale-110 active:scale-90 active:bg-white/25 transition-all duration-150 ${FOCUS}`;
  const DISABLED_BTN_CLASS =
    'flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white/20 cursor-not-allowed';
  const PLAY_BTN_CLASS = `ytx-btn ytx-tip flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 mx-0.5 rounded-full text-white bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-600/40 hover:shadow-pink-500/60 hover:scale-110 active:scale-90 transition-all duration-150 ${FOCUS}`;
  const GLASS =
    'flex items-center gap-0.5 p-1 rounded-full bg-black/40 backdrop-blur-md border border-white/15 shadow-lg shadow-black/30';
  const CIRCLE_BTN = `ytx-btn ytx-tip group flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full border text-white/90 hover:text-white shadow-lg shadow-black/30 hover:scale-110 active:scale-90 transition-all duration-200 ${FOCUS}`;
  const CIRCLE_IDLE = 'bg-black/40 backdrop-blur-md border-white/15 hover:bg-white/20 hover:border-white/30';
  const PILL_BTN = `inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur text-white text-sm font-semibold active:scale-95 transition-all ${FOCUS}`;
  const MENU_ROW = `w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm hover:bg-white/10 active:scale-[.98] transition-all ${FOCUS}`;

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const showUi = controlsVisible || !playing || seeking || showSettings || ended;
  const shownVolume = muted ? 0 : volume;
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPct = Math.min(100, buffered * 100);
  const hoverPct = hoverFrac === null ? 0 : Math.min(96, Math.max(4, hoverFrac * 100));
  const remaining = endedCountdown !== null && endedCountdown > 0 ? endedCountdown : null;
  const hasQualities = !!qualities && qualities.length > 0;
  const currentQualityLabel = autoQuality
    ? 'Auto'
    : qualities?.find((q) => q.src === currentSrc)?.label ?? 'Auto';
  const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;
  const centerVisible = !playing || (!buffering && isTouchRef.current && showUi);

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      className={`ytx-root relative w-full bg-black overflow-hidden select-none outline-none ${
        fakeFs
          ? 'fixed inset-0 z-[9999] h-full rounded-none border-0'
          : isFullscreen
          ? 'h-full rounded-none border-0 shadow-none'
          : 'aspect-video rounded-none border-0 sm:rounded-xl sm:border sm:border-purple-500/30 sm:shadow-[0_8px_40px_-12px_rgba(168,85,247,0.45)]'
      } ${!showUi && playing ? 'cursor-none' : ''}`}
      style={{ touchAction: 'none' }}
      onMouseMove={showControlsTemporarily}
      onMouseEnter={() => {
        hoverRef.current = true;
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        endHold();
      }}
    >
      <style>{`
        .ytx-root:focus, .ytx-root:focus-visible { outline: none !important; }
        .ytx-root:fullscreen, .ytx-root:-webkit-full-screen {
          border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
          outline: none !important; width: 100% !important; height: 100% !important;
        }
        .ytx-root:fullscreen::backdrop { background: #000; }

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

      {/* Video (zoom / pan / brightness) */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'center',
          filter: `brightness(${brightness})`,
        }}
      >
      <video
        ref={videoRef}
        src={currentSrc}
        poster={poster}
        loop={loop}
        autoPlay
        preload="metadata"
        playsInline
        className="w-full h-full object-contain pointer-events-none"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={() => {
          const v = videoRef.current;
          if (v && isFinite(v.duration)) {
            durationRef.current = v.duration;
            setDuration(v.duration);
          }
        }}
        onProgress={updateBuffered}
        onCanPlay={() => {
          setReady(true);
          setBuffering(false);
        }}
        onPlay={() => {
          setPlaying(true);
          playingRef.current = true;
          setEnded(false);
          endedRef.current = false;
        }}
        onPause={() => {
          setPlaying(false);
          playingRef.current = false;
          setBuffering(false);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => {
          setBuffering(false);
          setReady(true);
        }}
        onEnded={handleEnded}
        onRateChange={(e) => {
          if (holdActiveRef.current) return;
          const r = (e.target as HTMLVideoElement).playbackRate;
          rateRef.current = r;
          setPlaybackRate(r);
        }}
        onVolumeChange={(e) => {
          const v = e.target as HTMLVideoElement;
          const vol = Math.round(v.volume * 100);
          volumeRef.current = vol;
          mutedRef.current = v.muted;
          setVolume(vol);
          setMuted(v.muted);
        }}
        onError={(e) => console.error('Video error:', e)}
      />
      </div>

      {/* Tap zones: left (double-tap -15s), center (play / double-tap fullscreen), right (+15s) */}
      <div className="absolute inset-0 z-10 flex">
        <div className="w-2/5 h-full" aria-label="Double tap to rewind 15 seconds" {...zoneProps('left')} />
        <div className="w-1/5 h-full" {...zoneProps('center')} />
        <div className="w-2/5 h-full" aria-label="Double tap to forward 15 seconds" {...zoneProps('right')} />
      </div>

      {/* Title bar + watermark */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 px-4 pt-3 pb-8 bg-gradient-to-b from-black/70 to-transparent pointer-events-none transition-opacity duration-300 flex items-start justify-between gap-3 ${
          showUi ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {displayedTitle ? (
          <p
            onClick={handleTitleClick}
            title={isTitleTruncated ? 'Click to see full title' : ''}
            className={`text-white text-sm sm:text-base font-medium drop-shadow min-w-0 ${
              showFullTitle ? 'line-clamp-2' : 'truncate'
            } ${isTitleTruncated ? 'pointer-events-auto cursor-pointer' : ''}`}
          >
            {displayedTitle}
          </p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-80">
          <img
            src="/skull,logo.jpeg"
            alt="Animebing"
            className={`rounded-full ${isFullscreen ? 'w-9 h-9' : 'w-7 h-7'}`}
          />
          <span className={`text-white font-semibold ${isFullscreen ? 'text-sm' : 'text-xs'}`}>animebing.in</span>
        </div>
      </div>

      {/* Loading / buffering */}
      {(!ready || buffering) && !ended && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 pointer-events-none ytx-fadein">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-white/15" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 border-r-pink-400 animate-spin" />
          </div>
        </div>
      )}

      {/* Center play / pause button (hamesha mounted, sirf show/hide) */}
      {ready && !ended && (
        <div className="absolute inset-0 flex items-center justify-center pb-12 sm:pb-0 z-[35] pointer-events-none">
          <button
            type="button"
            data-ui
            onClick={(e) => {
              e.stopPropagation();
              lastTapRef.current = null;
              togglePlay();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={playing ? 'Pause' : 'Play'}
            tabIndex={centerVisible ? 0 : -1}
            className={`relative flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
              centerVisible
                ? 'opacity-100 scale-100 pointer-events-auto'
                : 'opacity-0 scale-75 pointer-events-none'
            }`}
            style={{ width: 52, height: 52, touchAction: 'manipulation' }}
          >
            {!playing && <span className="ytx-pulse absolute inset-0 rounded-full bg-pink-400/40" />}
            <span className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border border-white/30 shadow-[0_0_28px_rgba(236,72,153,0.5)]">
              {playing ? (
                <Pause size={22} className="text-white" fill="white" />
              ) : (
                <Play size={22} className="text-white ml-0.5" fill="white" />
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
        <div data-ui className="ytx-toast absolute left-3 bottom-24 z-40 flex items-center gap-3 rounded-xl bg-neutral-900/95 backdrop-blur border border-white/10 pl-4 pr-2 py-2 text-white text-xs sm:text-sm shadow-xl">
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
        <div data-ui className="ytx-fadein absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/75 backdrop-blur-sm px-4 text-center">
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
                      key={`ring-${currentSrc}-${ended}`}
                      className="ytx-ring"
                      cx="30"
                      cy="30"
                      r="26"
                      fill="none"
                      stroke="url(#vpGrad)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={RING_LEN}
                    />
                  )}
                  <defs>
                    <linearGradient id="vpGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <SkipForward size={26} className="text-white" fill="white" />
              </button>
              <div className="flex items-center gap-2">
                <button onClick={replay} className={PILL_BTN}>
                  <RotateCcw size={15} /> Replay
                </button>
                {remaining !== null && (
                  <button onClick={() => setCountdownCancelled(true)} className={PILL_BTN}>
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
        data-ui
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 sm:px-3 pt-8 pb-2 text-white z-30 transition-all duration-300 pointer-events-none ${
          showUi ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {/* Progress bar */}
        <div
          ref={barRef}
          className={`ytx-bar mx-1 ${seeking ? 'ytx-active' : ''} ${showUi ? 'pointer-events-auto' : 'pointer-events-none'}`}
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

        <div className={`flex items-center justify-between ${showUi ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`${GLASS} flex-shrink-0`}>
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
                {playing ? (
                  <Pause size={ICON_SIZE} fill="currentColor" />
                ) : (
                  <Play size={ICON_SIZE} fill="currentColor" className="ml-0.5" />
                )}
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

            <span className="whitespace-nowrap flex-shrink-0 text-white/90 text-[11px] sm:text-xs font-medium px-2 sm:px-2.5 py-1 ml-0.5 sm:ml-1 rounded-full bg-white/10 border border-white/10 tabular-nums">
              {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className={`hidden sm:flex ${GLASS}`}>
              <button
                onClick={() => skipBy(-SKIP_SECONDS)}
                className={BTN_CLASS}
                aria-label="Rewind 15 seconds"
                data-tip="Back 15s (j)"
              >
                <SeekIcon dir="back" />
              </button>
              <button
                onClick={() => skipBy(SKIP_SECONDS)}
                className={BTN_CLASS}
                aria-label="Forward 15 seconds"
                data-tip="Forward 15s (l)"
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

            {pipSupported && (
              <button
                onClick={togglePiP}
                className={`${CIRCLE_BTN} ytx-tip-end hidden sm:flex ${CIRCLE_IDLE}`}
                aria-label="Picture in picture"
                data-tip="Picture in picture"
              >
                <PictureInPicture2 size={ICON_SIZE} />
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
                    : CIRCLE_IDLE
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
              className={`${CIRCLE_BTN} ytx-tip-end ${CIRCLE_IDLE}`}
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

      {/* Settings menu */}
      {showSettings && (
        <div
          data-ui
          className="ytx-pop ytx-noscroll absolute right-2 sm:right-3 bottom-[4rem] z-50 w-60 max-w-[calc(100%-1rem)] max-h-[calc(100%-4.75rem)] overflow-y-auto overscroll-contain rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60 text-white"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={showControlsTemporarily}
        >
          {settingsPanel === 'main' && (
            <div className="p-1.5 space-y-0.5">
              {hasQualities && (
                <button onClick={() => setSettingsPanel('quality')} className={MENU_ROW}>
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white/80">
                    <SlidersHorizontal size={16} />
                  </span>
                  <span className="flex-1 text-left font-medium">Quality</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-semibold text-white/80">
                    {currentQualityLabel}
                  </span>
                  <ChevronRight size={14} className="text-white/40" />
                </button>
              )}
              <button onClick={() => setSettingsPanel('speed')} className={MENU_ROW}>
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
                className={MENU_ROW}
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
                className={MENU_ROW}
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
              <button onClick={toggleMute} className={`${MENU_ROW} sm:hidden`}>
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white/80">
                  <VolumeIcon size={16} />
                </span>
                <span className="flex-1 text-left font-medium">Mute</span>
                <Switch on={muted || volume === 0} />
              </button>
              {pipSupported && (
                <button
                  onClick={() => {
                    togglePiP();
                    closeMenus();
                  }}
                  className={`${MENU_ROW} sm:hidden`}
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white/80">
                    <PictureInPicture2 size={16} />
                  </span>
                  <span className="flex-1 text-left font-medium">Picture in picture</span>
                </button>
              )}
            </div>
          )}

          {settingsPanel === 'speed' && (
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

          {settingsPanel === 'quality' && hasQualities && (
            <div className="p-1.5 space-y-0.5">
              <button
                onClick={() => setSettingsPanel('main')}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sm font-semibold hover:bg-white/10 active:scale-[.98] transition-all ${FOCUS}`}
              >
                <ChevronLeft size={18} />
                Quality
              </button>
              <button
                onClick={() => {
                  setAutoQuality(true);
                  closeMenus();
                }}
                className={`${MENU_ROW} justify-between`}
              >
                <span className="font-medium">Auto</span>
                {autoQuality && <Check size={14} className="text-purple-400" />}
              </button>
              {qualities!.map((q) => (
                <button
                  key={q.src}
                  onClick={() => {
                    setAutoQuality(false);
                    selectQuality(q.src);
                    closeMenus();
                  }}
                  className={`${MENU_ROW} justify-between`}
                >
                  <span className="font-medium">{q.label}</span>
                  {q.src === currentSrc && !autoQuality && <Check size={14} className="text-purple-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
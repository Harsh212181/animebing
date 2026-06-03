 import React, { useRef, useState, useEffect, useCallback } from 'react';

interface VideoPlayerProps {
  src: string;
  qualities?: { label: string; src: string }[];
  poster?: string;
  title?: string;
  episode?: number | string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, qualities, poster, title, episode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapZoneRef = useRef<string | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSwiping = useRef<boolean>(false);
  const swipeStartPos = useRef<{ x: number; y: number } | null>(null);
  const skipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrame = useRef<number | null>(null);
  const targetScale = useRef(1);

  // Refs for keyboard handlers
  const togglePlayRef = useRef<() => void>(() => {});
  const skipBackwardRef = useRef<() => void>(() => {});
  const skipForwardRef = useRef<() => void>(() => {});
  const volumeUpRef = useRef<() => void>(() => {});
  const volumeDownRef = useRef<() => void>(() => {});
  const handleFullscreenRef = useRef<() => void>(() => {});

  const fullscreenStatePushed = useRef(false);

  // Swipe gesture refs
  const swipeStartY = useRef<number | null>(null);
  const swipeSide = useRef<'left' | 'right' | null>(null);

  // ----- States -----
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [skip, setSkip] = useState<{ direction: 'left' | 'right'; active: boolean; seconds: number }>({
    direction: 'left',
    active: false,
    seconds: 0,
  });
  const [brightness, setBrightness] = useState(1);
  const [showBrightnessPopup, setShowBrightnessPopup] = useState(false);
  const [autoQuality, setAutoQuality] = useState(true);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastPinchDistance = useRef<number | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const brightnessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFullscreenRef = useRef(isFullscreen);

  // New state for title expansion
  const [showFullTitle, setShowFullTitle] = useState(false);
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  const isOurFullscreenActive = () => {
    const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement;
    return fsElement === containerRef.current || fsElement === videoRef.current;
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(err => console.error('Autoplay failed:', err));
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const ourFullscreen = isOurFullscreenActive();
      setIsFullscreen(ourFullscreen);
      if (ourFullscreen) {
        if (!fullscreenStatePushed.current) {
          window.history.pushState({ fullscreen: true }, '');
          fullscreenStatePushed.current = true;
        }
      } else {
        if (fullscreenStatePushed.current) {
          window.history.replaceState({}, '');
          fullscreenStatePushed.current = false;
        }
        setScale(1);
        setTranslate({ x: 0, y: 0 });
        targetScale.current = 1;
      }
    };
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    events.forEach(event => document.addEventListener(event, handleFullscreenChange));
    return () => {
      events.forEach(event => document.removeEventListener(event, handleFullscreenChange));
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (isOurFullscreenActive()) {
        document.exitFullscreen();
        fullscreenStatePushed.current = false;
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ✅ Show controls temporarily – 3 seconds (YouTube style)
  const showControlsTemporarily = () => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (playing && !showQualityMenu) {
      hideTimeoutRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  };

  useEffect(() => {
    const startHideTimer = () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (playing && !showQualityMenu) {
        hideTimeoutRef.current = setTimeout(() => setControlsVisible(false), 3000);
      } else {
        setControlsVisible(true);
      }
    };
    startHideTimer();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [playing, showQualityMenu]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => console.error('Play failed:', err));
      }
      setPlaying(!playing);
      showControlsTemporarily();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
    showControlsTemporarily();
  };

  const MAX_SKIP = 120;
  const showSkipFeedback = (direction: 'left' | 'right') => {
    setSkip(prev => {
      const newSeconds = prev.direction === direction ? prev.seconds + 15 : 15;
      return { direction, active: true, seconds: Math.min(newSeconds, MAX_SKIP) };
    });
    if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
    skipTimeoutRef.current = setTimeout(() => {
      setSkip({ direction: 'left', active: false, seconds: 0 });
    }, 800);
  };

  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 15, duration);
      showSkipFeedback('right');
    }
    showControlsTemporarily();
  };

  const skipBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 15, 0);
      showSkipFeedback('left');
    }
    showControlsTemporarily();
  };

  const volumeDown = () => {
    const newVolume = Math.max(0, volume - 0.1);
    setVolume(newVolume);
    if (videoRef.current) videoRef.current.volume = newVolume;
    setShowVolumePopup(true);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolumePopup(false), 2000);
    showControlsTemporarily();
  };

  const volumeUp = () => {
    const newVolume = Math.min(1, volume + 0.1);
    setVolume(newVolume);
    if (videoRef.current) videoRef.current.volume = newVolume;
    setShowVolumePopup(true);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolumePopup(false), 2000);
    showControlsTemporarily();
  };

  const handleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      try {
        await containerRef.current.requestFullscreen();
        if (screen.orientation && 'lock' in screen.orientation) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch {}
        }
      } catch (err) {
        console.warn('Fullscreen request failed:', err);
      }
    } else {
      try {
        if (screen.orientation && 'unlock' in screen.orientation) {
          try {
            (screen.orientation as any).unlock();
          } catch {}
        }
        await document.exitFullscreen();
      } catch (err) {
        console.warn('Exit fullscreen failed:', err);
      }
    }
    showControlsTemporarily();
  };

  const handleQualityChange = (newSrc: string) => {
    const wasPlaying = playing;
    setCurrentSrc(newSrc);
    setShowQualityMenu(false);
    if (videoRef.current) {
      videoRef.current.src = newSrc;
      videoRef.current.load();
      if (wasPlaying) videoRef.current.play().catch(err => console.error('Play after quality change failed:', err));
    }
    showControlsTemporarily();
  };

  const detectAutoQuality = () => {
    if (!qualities || qualities.length === 0) return;
    const connection = (navigator as any).connection;
    if (!connection) return;
    const downlink = connection.downlink;
    let selectedQuality = qualities[0];
    if (downlink > 5 && qualities.length >= 3) selectedQuality = qualities[2];
    else if (downlink > 2 && qualities.length >= 2) selectedQuality = qualities[1];
    if (selectedQuality.src !== currentSrc) handleQualityChange(selectedQuality.src);
  };

  useEffect(() => {
    if (!autoQuality) return;
    detectAutoQuality();
    const connection = (navigator as any).connection;
    if (connection) connection.addEventListener('change', detectAutoQuality);
    return () => {
      if (connection) connection.removeEventListener('change', detectAutoQuality);
    };
  }, [qualities, autoQuality, currentSrc]);

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP failed:', err);
    }
    showControlsTemporarily();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const savedTime = localStorage.getItem(`video-progress-${currentSrc}`);
    if (savedTime) {
      const onLoaded = () => {
        video.currentTime = parseFloat(savedTime);
        video.removeEventListener('loadedmetadata', onLoaded);
      };
      video.addEventListener('loadedmetadata', onLoaded);
    }
  }, [currentSrc]);

  useEffect(() => {
    if (!videoRef.current) return;
    const interval = setInterval(() => {
      localStorage.setItem(`video-progress-${currentSrc}`, videoRef.current!.currentTime.toString());
    }, 5000);
    return () => clearInterval(interval);
  }, [currentSrc]);

  const showRipple = (x: number, y: number) => {
    setRipple({ x, y });
    setTimeout(() => setRipple(null), 500);
  };

  const skipForwardWithRipple = (clientX?: number, clientY?: number) => {
    if (clientX !== undefined && clientY !== undefined) showRipple(clientX, clientY);
    skipForward();
  };

  const skipBackwardWithRipple = (clientX?: number, clientY?: number) => {
    if (clientX !== undefined && clientY !== undefined) showRipple(clientX, clientY);
    skipBackward();
  };

  const smoothScaleUpdate = () => {
    setScale(prev => prev + (targetScale.current - prev) * 0.15);
    animationFrame.current = requestAnimationFrame(smoothScaleUpdate);
  };

  useEffect(() => {
    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      lastPinchDistance.current = distance;
      return;
    }
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      swipeStartPos.current = { x: touch.clientX, y: touch.clientY };
      swipeStartY.current = touch.clientY;
      swipeSide.current = touch.clientX < window.innerWidth / 2 ? 'left' : 'right';
      isSwiping.current = false;
      if (scale > 1) {
        setIsDragging(true);
        dragStart.current = { x: touch.pageX - translate.x, y: touch.pageY - translate.y };
      }
    }
    showControlsTemporarily();
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isSwiping.current || scale > 1 || e.touches.length === 2) e.preventDefault();
    if (e.touches.length === 2) {
      const distance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      if (lastPinchDistance.current) {
        const delta = distance / lastPinchDistance.current;
        targetScale.current = Math.min(3, Math.max(0.5, targetScale.current * delta));
        if (!animationFrame.current) animationFrame.current = requestAnimationFrame(smoothScaleUpdate);
      }
      lastPinchDistance.current = distance;
      return;
    }
    if (e.touches.length === 1) {
      if (scale > 1 && isDragging) {
        const newX = e.touches[0].pageX - dragStart.current.x;
        const newY = e.touches[0].pageY - dragStart.current.y;
        if (containerRef.current) {
          const containerWidth = containerRef.current.clientWidth;
          const containerHeight = containerRef.current.clientHeight;
          const videoWidth = containerWidth * scale;
          const videoHeight = containerHeight * scale;
          const maxX = (videoWidth - containerWidth) / 2;
          const maxY = (videoHeight - containerHeight) / 2;
          setTranslate({
            x: Math.min(maxX, Math.max(-maxX, newX)),
            y: Math.min(maxY, Math.max(-maxY, newY)),
          });
        }
        return;
      }
      if (!isSwiping.current && swipeStartPos.current) {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - swipeStartPos.current.x);
        const dy = Math.abs(touch.clientY - swipeStartPos.current.y);
        if (dx > 10 || dy > 10) {
          isSwiping.current = true;
          if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
            tapTimeoutRef.current = null;
          }
        }
      }
      if (isSwiping.current && swipeStartY.current !== null && swipeSide.current) {
        const deltaY = swipeStartY.current - e.touches[0].clientY;
        if (swipeSide.current === 'left') {
          let newBrightness = brightness + deltaY / 500;
          newBrightness = Math.max(0.3, Math.min(newBrightness, 2));
          setBrightness(newBrightness);
          setShowBrightnessPopup(true);
          if (brightnessTimeoutRef.current) clearTimeout(brightnessTimeoutRef.current);
          brightnessTimeoutRef.current = setTimeout(() => setShowBrightnessPopup(false), 2000);
        }
        if (swipeSide.current === 'right') {
          let newVolume = volume + deltaY / 500;
          newVolume = Math.max(0, Math.min(newVolume, 1));
          setVolume(newVolume);
          if (videoRef.current) videoRef.current.volume = newVolume;
          setShowVolumePopup(true);
          if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
          volumeTimeoutRef.current = setTimeout(() => setShowVolumePopup(false), 2000);
        }
        swipeStartY.current = e.touches[0].clientY;
      }
    }
    showControlsTemporarily();
  }, [brightness, volume, scale, translate, isDragging, isSwiping, swipeSide, swipeStartY, dragStart, lastPinchDistance]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => container.removeEventListener('touchmove', handleTouchMove);
  }, [handleTouchMove]);

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current && swipeSide.current && e.changedTouches.length > 0 && e.touches.length === 0) {
      const zone = swipeSide.current;
      const touch = e.changedTouches[0];
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      if (timeSinceLastTap < 300 && lastTapZoneRef.current === zone) {
        if (zone === 'left') skipBackwardWithRipple(touch.clientX, touch.clientY);
        else skipForwardWithRipple(touch.clientX, touch.clientY);
        lastTapTimeRef.current = 0;
        lastTapZoneRef.current = null;
      } else {
        lastTapTimeRef.current = now;
        lastTapZoneRef.current = zone;
        tapTimeoutRef.current = setTimeout(() => {
          lastTapTimeRef.current = 0;
          lastTapZoneRef.current = null;
          tapTimeoutRef.current = null;
        }, 300);
      }
    }
    setIsDragging(false);
    lastPinchDistance.current = null;
    swipeStartY.current = null;
    swipeSide.current = null;
    swipeStartPos.current = null;
    isSwiping.current = false;
    showControlsTemporarily();
  };

  const handleDoubleTap = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    targetScale.current = 1;
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  useEffect(() => {
    togglePlayRef.current = togglePlay;
    skipBackwardRef.current = skipBackward;
    skipForwardRef.current = skipForward;
    volumeUpRef.current = volumeUp;
    volumeDownRef.current = volumeDown;
    handleFullscreenRef.current = handleFullscreen;
  }, [togglePlay, skipBackward, skipForward, volumeUp, volumeDown, handleFullscreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (showQualityMenu) return;
      switch (e.key) {
        case ' ':
        case 'Space':
          e.preventDefault();
          togglePlayRef.current();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackwardRef.current();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForwardRef.current();
          break;
        case 'ArrowUp':
          e.preventDefault();
          volumeUpRef.current();
          break;
        case 'ArrowDown':
          e.preventDefault();
          volumeDownRef.current();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handleFullscreenRef.current();
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showQualityMenu]);

  useEffect(() => {
    return () => {
      if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
      if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    };
  }, []);

  // ---- Title display logic ----
  const animeTitle = title || '';
  
  const hasEpisode = episode !== undefined && episode !== null && episode !== '';
  const episodeStr = hasEpisode ? ` Ep ${episode}` : '';
  const fullTitle = `${animeTitle}${episodeStr}`;
  
  const MAX_TITLE_LEN = 30;
  const truncatedAnime = animeTitle.length > MAX_TITLE_LEN
    ? animeTitle.slice(0, MAX_TITLE_LEN) + '...'
    : animeTitle;
  const truncatedTitle = `${truncatedAnime}${episodeStr}`;
  
  const displayedTitle = showFullTitle ? fullTitle : truncatedTitle;
  const isTitleTruncated = animeTitle.length > MAX_TITLE_LEN;

  const handleTitleClick = () => {
    if (!isTitleTruncated) return;
    setShowFullTitle(true);
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => {
      setShowFullTitle(false);
    }, 3000);
  };

  const showLeftOverlay = skip.active && skip.direction === 'left';
  const showRightOverlay = skip.active && skip.direction === 'right';

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black outline-none ${isFullscreen ? 'fullscreen-mode' : ''}`}
      style={{ touchAction: 'pan-y' }}
      tabIndex={-1}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseMove={showControlsTemporarily}
    >
      <style>{`
        @keyframes fadeInScale {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes zoomIn {
          0% { transform: scale(0); opacity: 0; }
          80% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes rippleAnim {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
        .watermark-container {
          animation: fadeInScale 0.5s ease-out forwards;
        }
        .watermark-logo {
          animation: zoomIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .watermark-text {
          animation: fadeIn 0.8s ease-in forwards;
        }
      `}</style>

      {/* Anime title on top left */}
      {displayedTitle && (
        <div
          className={`absolute top-1 left-3 z-40 pointer-events-auto text-white text-sm font-semibold break-words line-clamp-2 px-1 transition-opacity duration-300 cursor-pointer ${
            controlsVisible ? 'opacity-100' : 'opacity-0'
          } ${isFullscreen ? 'text-base' : ''}`}
          style={{ maxWidth: 'calc(100% - 6rem)', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          onClick={handleTitleClick}
          title={isTitleTruncated ? 'Click to see full title' : ''}
        >
          {displayedTitle}
        </div>
      )}

      {/* Watermark */}
      <div
        className={`absolute top-1 right-3 flex items-center space-x-2 z-40 pointer-events-none watermark-container transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <img
          src="/skull,logo.jpeg"
          alt="Animebing"
          className={`w-7 h-7 rounded-full opacity-80 watermark-logo ${isFullscreen ? 'w-10 h-10' : ''}`}
        />
        <span className={`text-white font-semibold opacity-80 watermark-text ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
          animebing.in
        </span>
      </div>

      {/* Video container with zoom and brightness */}
      <div
        style={{
          transform: `scale(${scale}) translate(${translate.x}px, ${translate.y}px)`,
          transformOrigin: 'center',
          width: '100%',
          height: '100%',
          filter: `brightness(${brightness})`,
        }}
        className="relative overflow-hidden"
      >
        <video
          ref={videoRef}
          src={currentSrc}
          poster={poster}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            setIsBuffering(false);
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onError={(e) => console.error('Video error:', e)}
          className="w-full h-full object-contain"
          playsInline
        />
      </div>

      {/* Buffering spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className={`border-4 border-white border-t-transparent rounded-full animate-spin ${isFullscreen ? 'w-16 h-16' : 'w-12 h-12'}`} />
        </div>
      )}

      {/* Ripple overlay */}
      {ripple && (
        <div
          className="absolute pointer-events-none z-40"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.3)',
            transform: 'translate(-50%, -50%)',
            animation: 'rippleAnim 0.5s ease-out',
          }}
        />
      )}

      {/* Centered play overlay */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <span className={`text-white ${isFullscreen ? 'text-6xl' : 'text-4xl'}`} style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
            ▶
          </span>
        </div>
      )}

      {/* Skip feedback overlays */}
      {showLeftOverlay && (
        <div className={`absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/70 text-white font-bold px-3 py-1 rounded z-30 ${isFullscreen ? 'text-5xl' : 'text-4xl'}`}>
          -{skip.seconds}
        </div>
      )}
      {showRightOverlay && (
        <div className={`absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/70 text-white font-bold px-3 py-1 rounded z-30 ${isFullscreen ? 'text-5xl' : 'text-4xl'}`}>
          +{skip.seconds}
        </div>
      )}

      {/* Brightness popup */}
      {showBrightnessPopup && (
        <div className={`absolute top-1/2 left-4 transform -translate-y-1/2 bg-yellow-500/80 px-3 py-1 rounded text-white z-30 ${isFullscreen ? 'text-base' : 'text-sm'}`}>
          ☀ {Math.round(brightness * 100)}%
        </div>
      )}

      {/* Volume popup */}
      {showVolumePopup && (
        <div className={`absolute top-1/2 right-4 transform -translate-y-1/2 bg-purple-600/80 px-3 py-1 rounded text-white z-30 ${isFullscreen ? 'text-base' : 'text-sm'}`}>
          🔊 {Math.round(volume * 100)}%
        </div>
      )}

      {/* Gesture zones – controls toggle on single tap */}
      <div className="absolute inset-0 z-10 flex">
        <div className="w-1/3 h-full" onClick={() => {
          if (controlsVisible) setControlsVisible(false);
          else showControlsTemporarily();
        }} />
        <div className="w-1/3 h-full" onClick={() => {
          if (controlsVisible) { setControlsVisible(false); return; }
          togglePlay();
        }} onDoubleClick={handleDoubleTap} />
        <div className="w-1/3 h-full" onClick={() => {
          if (controlsVisible) setControlsVisible(false);
          else showControlsTemporarily();
        }} />
      </div>

      {/* Professional Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
        <div className="relative px-3 pb-3 pt-8">
          {/* Progress bar with time */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white/70 text-xs font-mono tabular-nums min-w-[38px]">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 accent-purple-500 cursor-pointer"
              style={{ height: '4px' }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            />
            <span className="text-white/50 text-xs font-mono tabular-nums min-w-[38px] text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* Button row */}
          <div className="flex items-center justify-between">
            {/* Left group */}
            <div className="flex items-center gap-1">
              <button onClick={togglePlay} onTouchStart={(e) => e.stopPropagation()}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
                title={playing ? 'Pause' : 'Play'}
              >
                {playing ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              <button onClick={skipBackward} onTouchStart={(e) => e.stopPropagation()}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
                title="-15s"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                  <text x="8.5" y="14" fontSize="5" fill="currentColor" fontWeight="bold">15</text>
                </svg>
              </button>

              <button onClick={skipForward} onTouchStart={(e) => e.stopPropagation()}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
                title="+15s"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 5V2l4 4-4 4V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                  <text x="8.5" y="14" fontSize="5" fill="currentColor" fontWeight="bold">15</text>
                </svg>
              </button>

              <button onClick={volumeDown} onTouchStart={(e) => e.stopPropagation()}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
                title="Volume -"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5zm7-.17v6.34L9.83 13H7v-2h2.83L12 8.83z"/>
                  <line x1="21" y1="9" x2="21" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>

              <button onClick={volumeUp} onTouchStart={(e) => e.stopPropagation()}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
                title="Volume +"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              </button>
            </div>

            {/* Right group */}
            <div className="flex items-center gap-1">
              {qualities && qualities.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); }}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="h-9 px-2.5 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white text-xs font-semibold tracking-wide"
                  >
                    {autoQuality ? 'AUTO' : (qualities.find(q => q.src === currentSrc)?.label || 'HD')}
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[90px]">
                      <button
                        onClick={(e) => { e.stopPropagation(); setAutoQuality(true); setShowQualityMenu(false); }}
                        onTouchStart={(e) => e.stopPropagation()}
                        className={`block w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-white/10 transition-colors ${autoQuality ? 'text-purple-400' : 'text-white/80'}`}
                      >
                        Auto
                      </button>
                      {qualities.map(q => (
                        <button
                          key={q.src}
                          onClick={(e) => { e.stopPropagation(); setAutoQuality(false); handleQualityChange(q.src); }}
                          onTouchStart={(e) => e.stopPropagation()}
                          className={`block w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-white/10 transition-colors ${q.src === currentSrc && !autoQuality ? 'text-purple-400 font-bold' : 'text-white/80'}`}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button onClick={togglePiP} onTouchStart={(e) => e.stopPropagation()}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
                title="Picture in Picture"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.99 2 1.99h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/>
                </svg>
              </button>

              <button onClick={handleFullscreen} onTouchStart={(e) => e.stopPropagation()}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
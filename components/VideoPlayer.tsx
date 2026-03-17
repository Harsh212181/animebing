 import React, { useRef, useState, useEffect, useCallback } from 'react';

interface VideoPlayerProps {
  src: string;
  qualities?: { label: string; src: string }[];
  poster?: string;
  title?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, qualities, poster, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapZoneRef = useRef<string | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSwiping = useRef<boolean>(false);
  const swipeStartPos = useRef<{ x: number; y: number } | null>(null);

  // ✅ NEW: Skip timeout ref
  const skipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for keyboard handlers
  const togglePlayRef = useRef<() => void>(() => {});
  const skipBackwardRef = useRef<() => void>(() => {});
  const skipForwardRef = useRef<() => void>(() => {});
  const volumeUpRef = useRef<() => void>(() => {});
  const volumeDownRef = useRef<() => void>(() => {});
  const handleFullscreenRef = useRef<() => void>(() => {});

  // Refs for fullscreen history management
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

  // Consolidated skip state
  const [skip, setSkip] = useState<{ direction: 'left' | 'right'; active: boolean; seconds: number }>({
    direction: 'left',
    active: false,
    seconds: 0,
  });

  // Brightness and auto quality
  const [brightness, setBrightness] = useState(1);
  const [showBrightnessPopup, setShowBrightnessPopup] = useState(false);
  const [autoQuality, setAutoQuality] = useState(true);

  // Volume popup
  const [showVolumePopup, setShowVolumePopup] = useState(false);

  // Zoom and pan - scale from 0.5 to 3
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastPinchDistance = useRef<number | null>(null);

  // Buffering spinner
  const [isBuffering, setIsBuffering] = useState(false);

  // Double‑tap ripple
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);

  // Timeout refs for popups
  const brightnessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep latest isFullscreen in ref for orientation handler
  const isFullscreenRef = useRef(isFullscreen);
  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  // Helper to check if our player is the fullscreen element
  const isOurFullscreenActive = () => {
    const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement;
    return fsElement === containerRef.current || fsElement === videoRef.current;
  };

  // Focus container
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // Sync src
  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  // Autoplay
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(err => {
        console.error('Autoplay failed:', err);
      });
    }
  }, []);

  // Fullscreen change listener + history (with vendor prefixes)
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
        // Reset zoom when exiting fullscreen
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }
    };

    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    events.forEach(event => document.addEventListener(event, handleFullscreenChange));
    return () => {
      events.forEach(event => document.removeEventListener(event, handleFullscreenChange));
    };
  }, []);

  // Popstate (back button) handler – exit fullscreen if active
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

  // Auto-hide controls
  useEffect(() => {
    const startHideTimer = () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (playing && !showQualityMenu) {
        hideTimeoutRef.current = setTimeout(() => {
          setControlsVisible(false);
        }, 10000);
      } else {
        setControlsVisible(true);
      }
    };
    startHideTimer();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [playing, showQualityMenu]);

  const showControlsTemporarily = () => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (playing && !showQualityMenu) {
      hideTimeoutRef.current = setTimeout(() => setControlsVisible(false), 10000);
    }
  };

  // ----- Playback functions -----
  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error('Play failed:', err);
        });
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
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
    showControlsTemporarily();
  };

  // ✅ FIXED: showSkipFeedback with proper timeout management
  const MAX_SKIP = 120; // optional limit
  const showSkipFeedback = (direction: 'left' | 'right') => {
    setSkip(prev => {
      const newSeconds = prev.direction === direction ? prev.seconds + 15 : 15;
      return {
        direction,
        active: true,
        seconds: Math.min(newSeconds, MAX_SKIP), // cap if desired
      };
    });

    // Clear previous timeout
    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
    }

    // Set new timeout to hide overlay after 800ms
    skipTimeoutRef.current = setTimeout(() => {
      setSkip({
        direction: 'left',
        active: false,
        seconds: 0,
      });
    }, 800); // 800ms feels snappy
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
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    // Show volume popup for 2 seconds
    setShowVolumePopup(true);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolumePopup(false), 2000);
    showControlsTemporarily();
  };

  const volumeUp = () => {
    const newVolume = Math.min(1, volume + 0.1);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    // Show volume popup for 2 seconds
    setShowVolumePopup(true);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolumePopup(false), 2000);
    showControlsTemporarily();
  };

  // ----- FULLSCREEN WITH ORIENTATION LOCK -----
  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      try {
        await containerRef.current.requestFullscreen();
        if (screen.orientation && 'lock' in screen.orientation) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch (orientationErr) {
            // ignore
          }
        }
      } catch (err) {
        console.warn('Fullscreen request failed:', err);
      }
    } else {
      try {
        if (screen.orientation && 'unlock' in screen.orientation) {
          try {
            (screen.orientation as any).unlock();
          } catch {
            // ignore
          }
        }
        await document.exitFullscreen();
      } catch (err) {
        console.warn('Exit fullscreen failed:', err);
      }
    }
    showControlsTemporarily();
  };

  // ----- Quality change -----
  const handleQualityChange = (newSrc: string) => {
    const wasPlaying = playing;
    setCurrentSrc(newSrc);
    setShowQualityMenu(false);
    if (videoRef.current) {
      videoRef.current.src = newSrc;
      videoRef.current.load();
      if (wasPlaying) {
        videoRef.current.play().catch(err => {
          console.error('Play after quality change failed:', err);
        });
      }
    }
    showControlsTemporarily();
  };

  const detectAutoQuality = () => {
    if (!qualities || qualities.length === 0) return;
    const connection = (navigator as any).connection;
    if (!connection) return;

    const downlink = connection.downlink;
    let selectedQuality = qualities[0];

    if (downlink > 5 && qualities.length >= 3) {
      selectedQuality = qualities[2];
    } else if (downlink > 2 && qualities.length >= 2) {
      selectedQuality = qualities[1];
    } else {
      selectedQuality = qualities[0];
    }

    if (selectedQuality.src !== currentSrc) {
      handleQualityChange(selectedQuality.src);
    }
  };

  useEffect(() => {
    if (!autoQuality) return;
    detectAutoQuality();

    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', detectAutoQuality);
    }

    return () => {
      if (connection) {
        connection.removeEventListener('change', detectAutoQuality);
      }
    };
  }, [qualities, autoQuality, currentSrc]);

  // ----- Picture‑in‑Picture -----
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

  // ----- Resume playback (wait for metadata) -----
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

  // Save progress every 5 seconds
  useEffect(() => {
    if (!videoRef.current) return;
    const interval = setInterval(() => {
      localStorage.setItem(
        `video-progress-${currentSrc}`,
        videoRef.current!.currentTime.toString()
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [currentSrc]);

  // ----- Ripple animation -----
  const showRipple = (x: number, y: number) => {
    setRipple({ x, y });
    setTimeout(() => setRipple(null), 500);
  };

  const skipForwardWithRipple = (clientX?: number, clientY?: number) => {
    if (clientX !== undefined && clientY !== undefined) {
      showRipple(clientX, clientY);
    }
    skipForward();
  };

  const skipBackwardWithRipple = (clientX?: number, clientY?: number) => {
    if (clientX !== undefined && clientY !== undefined) {
      showRipple(clientX, clientY);
    }
    skipBackward();
  };

  // ----- Touch handlers (manual, non‑passive) -----
  const handleTouchStart = (e: React.TouchEvent) => {
    // Ignore if two fingers (pinch) – we don't want to interfere with zoom
    if (e.touches.length === 2) {
      // Prepare for pinch
      const distance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      lastPinchDistance.current = distance;
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      swipeStartPos.current = { x: touch.clientX, y: touch.clientY };
      swipeStartY.current = touch.clientY;
      const screenWidth = window.innerWidth;
      swipeSide.current = touch.clientX < screenWidth / 2 ? 'left' : 'right';

      isSwiping.current = false;

      // If we are already zoomed, allow panning
      if (scale > 1) {
        setIsDragging(true);
        dragStart.current = {
          x: touch.pageX - translate.x,
          y: touch.pageY - translate.y,
        };
      }
    }
    showControlsTemporarily();
  };

  // This handler is attached manually with non‑passive option
  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();

    // Two fingers – pinch zoom
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      if (lastPinchDistance.current) {
        const delta = distance / lastPinchDistance.current;
        const newScale = Math.min(3, Math.max(0.5, scale * delta));
        setScale(newScale);
      }
      lastPinchDistance.current = distance;
      return;
    }

    // One finger – brightness/volume swipes or panning
    if (e.touches.length === 1) {
      // Panning when zoomed
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

      // Brightness/volume swipe
      if (!isSwiping.current && swipeStartPos.current) {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - swipeStartPos.current.x);
        const dy = Math.abs(touch.clientY - swipeStartPos.current.y);
        if (dx > 10 || dy > 10) {
          isSwiping.current = true;
          // Cancel any pending double-tap
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
          if (videoRef.current) {
            videoRef.current.volume = newVolume;
          }
          setShowVolumePopup(true);
          if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
          volumeTimeoutRef.current = setTimeout(() => setShowVolumePopup(false), 2000);
        }

        swipeStartY.current = e.touches[0].clientY;
      }
    }
    showControlsTemporarily();
  }, [brightness, volume, scale, translate, isDragging, isSwiping, swipeSide, swipeStartY, dragStart, lastPinchDistance]);

  // Set up manual touchmove listener with non‑passive option
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleTouchMove]);

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Single tap / double tap detection (only if not swiping and not pinch)
    if (!isSwiping.current && swipeSide.current && e.changedTouches.length > 0 && e.touches.length === 0) {
      const zone = swipeSide.current;
      const touch = e.changedTouches[0];
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;

      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      if (timeSinceLastTap < 300 && lastTapZoneRef.current === zone) {
        // Double tap on same side
        if (zone === 'left') {
          skipBackwardWithRipple(touch.clientX, touch.clientY);
        } else {
          skipForwardWithRipple(touch.clientX, touch.clientY);
        }
        lastTapTimeRef.current = 0;
        lastTapZoneRef.current = null;
      } else {
        // First tap – wait to see if it becomes a double tap
        lastTapTimeRef.current = now;
        lastTapZoneRef.current = zone;
        tapTimeoutRef.current = setTimeout(() => {
          lastTapTimeRef.current = 0;
          lastTapZoneRef.current = null;
          tapTimeoutRef.current = null;
        }, 300);
      }
    }

    // Reset all gesture states
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
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Update refs for keyboard
  useEffect(() => {
    togglePlayRef.current = togglePlay;
    skipBackwardRef.current = skipBackward;
    skipForwardRef.current = skipForward;
    volumeUpRef.current = volumeUp;
    volumeDownRef.current = volumeDown;
    handleFullscreenRef.current = handleFullscreen;
  }, [togglePlay, skipBackward, skipForward, volumeUp, volumeDown, handleFullscreen]);

  // Keyboard controls
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

  // ✅ Cleanup skip timeout on unmount
  useEffect(() => {
    return () => {
      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
      }
    };
  }, []);

  const showLeftOverlay = skip.active && skip.direction === 'left';
  const showRightOverlay = skip.active && skip.direction === 'right';

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black outline-none"
      style={{ touchAction: 'none' }}
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
      {title && (
        <div
          className="absolute top-1 left-3 z-40 pointer-events-none text-white text-sm font-semibold break-words line-clamp-2 px-1"
          style={{ maxWidth: 'calc(100% - 6rem)', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
        >
          {title}
        </div>
      )}

      {/* Watermark */}
      <div className="absolute top-1 right-3 flex items-center space-x-2 z-40 pointer-events-none watermark-container">
        <img
          src="/skull,logo.jpeg"
          alt="Animebing"
          className="w-7 h-7 rounded-full opacity-80 watermark-logo"
        />
        <span className="text-white text-xs font-semibold opacity-80 watermark-text">
          animebing.in
        </span>
      </div>

      {/* Video with zoom, pan and brightness filter */}
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
          onError={(e) => {
            console.error('Video error:', e);
          }}
          className="w-full h-full object-contain"
          playsInline
        />
      </div>

      {/* Buffering spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
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
          <span className="text-white text-4xl" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
            ▶
          </span>
        </div>
      )}

      {/* Skip feedback overlays (1 second) */}
      {showLeftOverlay && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/70 text-white text-4xl font-bold px-3 py-1 rounded z-30">
          -{skip.seconds}
        </div>
      )}
      {showRightOverlay && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/70 text-white text-4xl font-bold px-3 py-1 rounded z-30">
          +{skip.seconds}
        </div>
      )}

      {/* Brightness popup (2 seconds) */}
      {showBrightnessPopup && (
        <div className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-yellow-500/80 px-3 py-1 rounded text-white text-sm z-30">
          ☀ {Math.round(brightness * 100)}%
        </div>
      )}

      {/* Volume popup (2 seconds) */}
      {showVolumePopup && (
        <div className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-purple-600/80 px-3 py-1 rounded text-white text-sm z-30">
          🔊 {Math.round(volume * 100)}%
        </div>
      )}

      {/* Gesture zones (only for double‑tap detection, no long-press) */}
      <div className="absolute inset-0 z-10 flex">
        <div className="w-1/3 h-full" />
        <div className="w-1/3 h-full" onClick={togglePlay} onDoubleClick={handleDoubleTap} />
        <div className="w-1/3 h-full" />
      </div>

      {/* Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1 text-white z-20 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <input
          type="range"
          min={0}
          max={duration}
          value={currentTime}
          onChange={handleSeek}
          className="w-full mb-0 accent-purple-500"
          onTouchStart={(e) => e.stopPropagation()}
        />

        <div className="overflow-x-auto pb-1 no-scrollbar relative">
          <div className="flex items-center space-x-3 min-w-max">
            <button
              onClick={volumeDown}
              onTouchStart={(e) => e.stopPropagation()}
              className="flex-shrink-0 text-white/80 hover:text-white text-xl"
            >
              ♪–
            </button>
            <button
              onClick={volumeUp}
              onTouchStart={(e) => e.stopPropagation()}
              className="flex-shrink-0 text-white/80 hover:text-white text-xl"
            >
              ♪+
            </button>
            <span className="text-xs whitespace-nowrap flex-shrink-0 text-white/60">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Quality Button */}
            {qualities && qualities.length > 0 && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQualityMenu(!showQualityMenu);
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="text-sm text-white/80 hover:text-white px-2 py-1"
                >
                  Quality
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-gray-800/90 rounded shadow-lg z-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAutoQuality(true);
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-purple-700 ${
                        autoQuality ? 'text-green-400' : 'text-white/80'
                      }`}
                    >
                      Auto
                    </button>
                    {qualities.map(q => (
                      <button
                        key={q.src}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAutoQuality(false);
                          handleQualityChange(q.src);
                        }}
                        onTouchStart={(e) => e.stopPropagation()}
                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-purple-700 ${
                          q.src === currentSrc && !autoQuality ? 'font-bold text-purple-400' : 'text-white/80'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PiP Button */}
            <button
              onClick={togglePiP}
              onTouchStart={(e) => e.stopPropagation()}
              className="flex-shrink-0 text-white/80 hover:text-white"
            >
              PiP
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={handleFullscreen}
              onTouchStart={(e) => e.stopPropagation()}
              className="flex-shrink-0 text-white/80 hover:text-white text-1xl"
            >
              {isFullscreen ? '⤫' : '⛶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
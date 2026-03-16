 import React, { useRef, useState, useEffect } from 'react';

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
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skipIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeLongPressZone = useRef<string | null>(null);
  const isSwiping = useRef<boolean>(false);
  const swipeStartPos = useRef<{ x: number; y: number } | null>(null);

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

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [skipFeedback, setSkipFeedback] = useState<{ direction: 'left' | 'right'; active: boolean }>({
    direction: 'left',
    active: false,
  });
  const [continuousSkipActive, setContinuousSkipActive] = useState<'left' | 'right' | null>(null);
  const [skipSeconds, setSkipSeconds] = useState(0);

  // Brightness and auto quality
  const [brightness, setBrightness] = useState(1);
  const [showBrightnessPopup, setShowBrightnessPopup] = useState(false);
  const [autoQuality, setAutoQuality] = useState(true);

  const skipFeedbackRef = useRef(skipFeedback);
  useEffect(() => {
    skipFeedbackRef.current = skipFeedback;
  }, [skipFeedback]);

  // Zoom and pan
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastPinchDistance = useRef<number | null>(null);

  // Keep latest isFullscreen in ref for orientation handler
  const isFullscreenRef = useRef(isFullscreen);
  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  // Helper to check if our player is the fullscreen element
  const isOurFullscreenActive = () => {
    const fsElement = document.fullscreenElement;
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

  // Fullscreen change listener + history
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
        // Reset zoom when exiting fullscreen (optional)
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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

  const showSkipFeedback = (direction: 'left' | 'right') => {
    setSkipFeedback({ direction, active: true });

    setSkipSeconds(prev => {
      if (skipFeedbackRef.current.direction !== direction) {
        return 15;
      }
      return prev + 15;
    });

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);

    tapTimeoutRef.current = setTimeout(() => {
      setSkipFeedback(prev => ({ ...prev, active: false }));
      setSkipSeconds(0);
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
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setShowVolumePopup(true);
    setTimeout(() => setShowVolumePopup(false), 800);
    showControlsTemporarily();
  };

  const volumeUp = () => {
    const newVolume = Math.min(1, volume + 0.1);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setShowVolumePopup(true);
    setTimeout(() => setShowVolumePopup(false), 800);
    showControlsTemporarily();
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (videoRef.current?.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    showControlsTemporarily();
  };

  // Quality change
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
  }, [qualities, autoQuality]);

  // ----- Orientation-based fullscreen (like YouTube) -----
  useEffect(() => {
    // Only on mobile/touch devices
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isMobile) return;

    const handleOrientationChange = () => {
      // Use matchMedia to detect landscape
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      const currentFullscreen = isFullscreenRef.current;

      if (isLandscape && !currentFullscreen && containerRef.current) {
        // Landscape and not fullscreen -> enter fullscreen
        containerRef.current.requestFullscreen().catch(() => {});
      } else if (!isLandscape && currentFullscreen && document.fullscreenElement) {
        // Portrait and fullscreen -> exit fullscreen
        document.exitFullscreen().catch(() => {});
      }
    };

    const mql = window.matchMedia('(orientation: landscape)');
    mql.addEventListener('change', handleOrientationChange);
    return () => mql.removeEventListener('change', handleOrientationChange);
  }, []); // Empty deps – runs once, uses ref for latest fullscreen state

  // ----- Gesture handlers -----
  const SWIPE_THRESHOLD = 10;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      swipeStartPos.current = { x: touch.clientX, y: touch.clientY };
      swipeStartY.current = touch.clientY;
      const screenWidth = window.innerWidth;
      swipeSide.current = touch.clientX < screenWidth / 2 ? 'left' : 'right';

      isSwiping.current = false;

      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = setTimeout(() => {
        if (!isSwiping.current && swipeSide.current) {
          activeLongPressZone.current = swipeSide.current;
          setContinuousSkipActive(swipeSide.current);
          if (skipIntervalRef.current) clearInterval(skipIntervalRef.current);
          skipIntervalRef.current = setInterval(() => {
            if (swipeSide.current === 'left') {
              skipBackward();
            } else {
              skipForward();
            }
          }, 200);
        }
      }, 400);
    }

    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      lastPinchDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      dragStart.current = {
        x: e.touches[0].pageX - translate.x,
        y: e.touches[0].pageY - translate.y,
      };
    }
    showControlsTemporarily();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping.current && swipeStartPos.current && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - swipeStartPos.current.x);
      const dy = Math.abs(touch.clientY - swipeStartPos.current.y);
      if (dx > SWIPE_THRESHOLD || dy > SWIPE_THRESHOLD) {
        isSwiping.current = true;
        if (longPressTimeoutRef.current) {
          clearTimeout(longPressTimeoutRef.current);
          longPressTimeoutRef.current = null;
        }
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
          tapTimeoutRef.current = null;
        }
        if (activeLongPressZone.current) {
          if (skipIntervalRef.current) {
            clearInterval(skipIntervalRef.current);
            skipIntervalRef.current = null;
          }
          setContinuousSkipActive(null);
          activeLongPressZone.current = null;
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
        setTimeout(() => setShowBrightnessPopup(false), 800);
      }

      if (swipeSide.current === 'right') {
        let newVolume = volume + deltaY / 500;
        newVolume = Math.max(0, Math.min(newVolume, 1));
        setVolume(newVolume);
        if (videoRef.current) {
          videoRef.current.volume = newVolume;
        }
        setShowVolumePopup(true);
        setTimeout(() => setShowVolumePopup(false), 800);
      }

      swipeStartY.current = e.touches[0].clientY;
    }

    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      if (lastPinchDistance.current) {
        const delta = distance / lastPinchDistance.current;
        const newScale = Math.min(Math.max(scale * delta, 1), 3);
        setScale(newScale);
      }
      lastPinchDistance.current = distance;
    } else if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
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
    }
    showControlsTemporarily();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current && swipeSide.current) {
      const zone = swipeSide.current;
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;

      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      if (timeSinceLastTap < 300 && lastTapZoneRef.current === zone) {
        // Double tap
        if (zone === 'left') {
          skipBackward();
        } else {
          skipForward();
        }
        lastTapTimeRef.current = 0;
        lastTapZoneRef.current = null;
      } else {
        // First tap
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

    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    showControlsTemporarily();
  };

  const handleDoubleTap = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  // Long-press for mouse
  const startLongPress = (zone: 'left' | 'right') => {
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      activeLongPressZone.current = zone;
      setContinuousSkipActive(zone);
      if (skipIntervalRef.current) clearInterval(skipIntervalRef.current);
      skipIntervalRef.current = setInterval(() => {
        if (zone === 'left') {
          skipBackward();
        } else {
          skipForward();
        }
      }, 200);
    }, 400);
  };

  const endLongPress = (zone: 'left' | 'right') => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (activeLongPressZone.current === zone) {
      if (skipIntervalRef.current) {
        clearInterval(skipIntervalRef.current);
        skipIntervalRef.current = null;
      }
      setContinuousSkipActive(null);
      activeLongPressZone.current = null;
    }
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

  const showLeftOverlay = skipFeedback.active && skipFeedback.direction === 'left';
  const showRightOverlay = skipFeedback.active && skipFeedback.direction === 'right';
  const showContinuousLeft = continuousSkipActive === 'left';
  const showContinuousRight = continuousSkipActive === 'right';

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black overflow-hidden outline-none"
      style={{ touchAction: 'none' }}
      tabIndex={-1}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
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
      >
        <video
          ref={videoRef}
          src={currentSrc}
          poster={poster}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={(e) => {
            console.error('Video error:', e);
          }}
          className="w-full h-full object-contain"
          playsInline
        />
      </div>

      {/* Centered play overlay – exactly in the middle */}
      {!playing && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <span className="text-white text-6xl" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>▶</span>
        </div>
      )}

      {/* Skip feedback overlays */}
      {(showLeftOverlay || showContinuousLeft) && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/70 text-white text-4xl font-bold px-3 py-1 rounded z-30">
          -{skipSeconds || 15}
        </div>
      )}
      {(showRightOverlay || showContinuousRight) && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/70 text-white text-4xl font-bold px-3 py-1 rounded z-30">
          +{skipSeconds || 15}
        </div>
      )}

      {/* Brightness popup */}
      {showBrightnessPopup && (
        <div className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-yellow-500/80 px-3 py-1 rounded text-white text-sm z-30">
          ☀ {Math.round(brightness * 100)}%
        </div>
      )}

      {/* Volume popup */}
      {showVolumePopup && (
        <div className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-purple-600/80 px-3 py-1 rounded text-white text-sm z-30">
          🔊 {Math.round(volume * 100)}%
        </div>
      )}

      {/* Gesture zones */}
      <div className="absolute inset-0 z-10 flex">
        <div
          className="w-1/3 h-full"
          onTouchStart={() => {}} // Handled by container
          onTouchEnd={() => {}}
          onMouseDown={() => startLongPress('left')}
          onMouseUp={() => endLongPress('left')}
          onMouseLeave={() => endLongPress('left')}
        />
        <div
          className="w-1/3 h-full"
          onClick={togglePlay}
          onDoubleClick={handleDoubleTap}
        />
        <div
          className="w-1/3 h-full"
          onTouchStart={() => {}}
          onTouchEnd={() => {}}
          onMouseDown={() => startLongPress('right')}
          onMouseUp={() => endLongPress('right')}
          onMouseLeave={() => endLongPress('right')}
        />
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
        />

        <div className="overflow-x-auto pb-1 no-scrollbar">
          <div className="flex items-center space-x-3 min-w-max">
            <button onClick={volumeDown} className="flex-shrink-0 text-white/80 hover:text-white text-xl">♪–</button>
            <button onClick={volumeUp} className="flex-shrink-0 text-white/80 hover:text-white text-xl">♪+</button>
            {showVolumePopup && (
              <div className="flex-shrink-0 bg-purple-600/80 px-2 py-1 rounded text-sm text-white">
                {Math.round(volume * 100)}%
              </div>
            )}
            <span className="text-xs whitespace-nowrap flex-shrink-0 text-white/60">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            {qualities && qualities.length > 0 && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="text-sm text-white/80 hover:text-white px-2 py-1"
                >
                  Quality
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-gray-800/90 rounded shadow-lg">
                    <button
                      onClick={() => setAutoQuality(true)}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-purple-700 ${
                        autoQuality ? 'text-green-400' : 'text-white/80'
                      }`}
                    >
                      Auto
                    </button>
                    {qualities.map(q => (
                      <button
                        key={q.src}
                        onClick={() => {
                          setAutoQuality(false);
                          handleQualityChange(q.src);
                        }}
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
            <button onClick={handleFullscreen} className="flex-shrink-0 text-white/80 hover:text-white text-1xl">
              {isFullscreen ? 'Exit' : '⛶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
  showDetails: boolean;
  copied: boolean;
}

type ErrorKind = 'chunk' | 'network' | 'generic';

const getErrorKind = (error?: Error): ErrorKind => {
  const msg = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
  if (
    msg.includes('dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('chunkloaderror') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk')
  ) return 'chunk';
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
    return 'network';
  }
  return 'generic';
};

// Full class names (Tailwind purge-safe)
const THEMES: Record<ErrorKind, {
  title: string;
  description: string;
  iconBg: string;
  iconShadow: string;
  ring: string;
  dot: string;
  label: string;
  icon: string;
}> = {
  chunk: {
    title: "This page couldn't be loaded",
    description:
      "It usually happens because of a slow connection or a recent site update. Reloading the page normally fixes it.",
    iconBg: 'from-amber-500 via-orange-500 to-orange-600',
    iconShadow: 'shadow-amber-500/40',
    ring: 'border-amber-400/50',
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
    label: 'text-amber-300',
    // wifi-off
    icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01M4.93 12.93a10 10 0 0114.14 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0M3 3l18 18',
  },
  network: {
    title: 'Connection problem',
    description:
      "We can't reach the server right now. Check your internet connection and try again.",
    iconBg: 'from-amber-500 via-orange-500 to-orange-600',
    iconShadow: 'shadow-amber-500/40',
    ring: 'border-amber-400/50',
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
    label: 'text-amber-300',
    icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01M4.93 12.93a10 10 0 0114.14 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0M3 3l18 18',
  },
  generic: {
    title: 'Oops, something broke',
    description:
      'An unexpected error occurred. Try again, or reload the page to get back on track.',
    iconBg: 'from-purple-500 via-purple-600 to-fuchsia-600',
    iconShadow: 'shadow-purple-500/40',
    ring: 'border-purple-400/50',
    dot: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]',
    label: 'text-rose-300',
    // warning triangle
    icon: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  },
};

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    showDetails: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = Math.random().toString(36).substring(2, 8).toUpperCase();
    return { hasError: true, error, errorId, showDetails: false, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => window.location.reload();

  private handleHome = () => {
    window.location.href = '/';
  };

  private handleTryAgain = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined, showDetails: false, copied: false });
  };

  private handleCopy = async () => {
    const { error, errorId } = this.state;
    const text = [
      `Error ID: ${errorId}`,
      `Time: ${new Date().toISOString()}`,
      `Page: ${window.location.pathname}`,
      `Error: ${error?.name || 'Error'}: ${error?.message || 'Unknown'}`,
      '',
      error?.stack || '',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      /* clipboard blocked, ignore */
    }
  };

  public render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { error, errorId, showDetails, copied } = this.state;
    const kind = getErrorKind(error);
    const theme = THEMES[kind];
    // React.lazy caches a failed import, so "Try Again" can't recover from it
    const canRetry = kind === 'generic';

    return (
      <>
        <style>{`
          @keyframes ebFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes ebFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
          @keyframes ebPulseRing { 0% { transform: scale(0.9); opacity: 0.7; } 70% { transform: scale(1.3); opacity: 0; } 100% { transform: scale(1.3); opacity: 0; } }
          @keyframes ebShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          @keyframes ebOrb { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-20px) scale(1.1); } 66% { transform: translate(-20px,20px) scale(0.95); } }
          .eb-fade-in { animation: ebFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
          .eb-float { animation: ebFloat 3s ease-in-out infinite; }
          .eb-orb { animation: ebOrb 12s ease-in-out infinite; }
          .eb-pulse::before {
            content: ''; position: absolute; inset: 0; border-radius: 9999px;
            border-width: 2px; border-style: solid; border-color: inherit;
            animation: ebPulseRing 2s ease-out infinite;
          }
          .eb-shimmer {
            background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%);
            background-size: 200% 100%;
            animation: ebShimmer 2.5s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .eb-fade-in, .eb-float, .eb-orb, .eb-shimmer, .eb-pulse::before { animation: none !important; }
          }
        `}</style>

        <div className="relative min-h-screen w-full overflow-hidden bg-[#08060f] flex items-center justify-center p-4 sm:p-6">
          {/* Ambient orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="eb-orb absolute -top-40 -left-40 w-[420px] h-[420px] rounded-full bg-purple-600/20 blur-[120px]" />
            <div className="eb-orb absolute -bottom-40 -right-40 w-[460px] h-[460px] rounded-full bg-fuchsia-600/15 blur-[130px]" style={{ animationDelay: '-4s' }} />
            <div className="eb-orb absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-indigo-600/15 blur-[110px]" style={{ animationDelay: '-8s' }} />
          </div>

          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
            }}
          />

          {/* Card */}
          <div className="eb-fade-in relative w-full max-w-lg min-w-0">
            <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-purple-500/40 via-fuchsia-500/20 to-indigo-500/40 shadow-[0_20px_80px_-20px_rgba(139,92,246,0.5)]">
              <div className="relative rounded-3xl bg-[#0d0b18]/95 backdrop-blur-2xl overflow-hidden">
                <div className="eb-shimmer absolute top-0 left-0 right-0 h-[2px]" />

                <div className="relative px-6 sm:px-8 pt-10 pb-8 text-center">
                  {/* Icon */}
                  <div className="relative mx-auto mb-6 w-20 h-20 flex items-center justify-center">
                    <div className={`eb-pulse absolute inset-0 rounded-full ${theme.ring}`} />
                    <div className={`eb-float relative w-20 h-20 rounded-2xl bg-gradient-to-br ${theme.iconBg} flex items-center justify-center shadow-lg ${theme.iconShadow} ring-1 ring-white/10`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d={theme.icon} />
                      </svg>
                    </div>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2 break-words">
                    {theme.title}
                  </h1>
                  <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6 leading-relaxed break-words">
                    {theme.description}
                  </p>

                  {/* Actions */}
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={this.handleReload}
                      className="group w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-600/30 hover:shadow-purple-500/50 transition-all duration-200 active:scale-[0.98]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-hover:rotate-180 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reload Page
                    </button>

                    <div className={`grid gap-3 ${canRetry ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {canRetry && (
                        <button
                          onClick={this.handleTryAgain}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-gray-200 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/[0.16] transition-all duration-200 active:scale-[0.98]"
                        >
                          Try Again
                        </button>
                      )}
                      <button
                        onClick={this.handleHome}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-gray-200 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/[0.16] transition-all duration-200 active:scale-[0.98]"
                      >
                        Go to Home
                      </button>
                    </div>
                  </div>

                  {/* Technical details (collapsed by default) */}
                  <div className="mt-6 pt-4 border-t border-white/[0.06]">
                    <button
                      onClick={() => this.setState({ showDetails: !showDetails })}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 9l-7 7-7-7" />
                      </svg>
                      {showDetails ? 'Hide technical details' : 'Show technical details'}
                    </button>

                    {showDetails && (
                      <div className="mt-3 text-left rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                            <span className={`text-[11px] font-semibold uppercase tracking-wider ${theme.label}`}>
                              Error details
                            </span>
                          </div>
                          {errorId && <span className="text-[10px] font-mono text-gray-500">#{errorId}</span>}
                        </div>
                        <div className="px-4 py-3 max-h-32 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                          <p className="text-[12px] text-gray-300 font-mono break-all whitespace-pre-wrap leading-relaxed">
                            {error?.name || 'Error'}: {error?.message || 'Unknown error'}
                          </p>
                        </div>
                        <div className="px-4 py-2.5 border-t border-white/[0.06]">
                          <button
                            onClick={this.handleCopy}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-purple-300 hover:text-purple-200 transition-colors"
                          >
                            {copied ? (
                              <>
                                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 13l4 4L19 7" />
                                </svg>
                                Copied to clipboard
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy error details
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {errorId && (
              <p className="mt-5 text-center text-[11px] text-gray-600">
                Error ID: <span className="font-mono">#{errorId}</span>. Share it with us if the problem continues.
              </p>
            )}
          </div>
        </div>
      </>
    );
  }
}

export default ErrorBoundary;
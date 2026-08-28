 import React, { useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = 'https://animabing-backend.animabingwatch.workers.dev/api';

interface PollOption {
  _id: string;
  title: string;
  animeId: string;
  image: string;
  votes: number;
  percentage?: number;
  order: number;
  isCustom: boolean;
}

interface Poll {
  _id: string;
  question: string;
  options: PollOption[];
  expiresAt: string;
  isActive: boolean;
  totalVotes: number;
  userHasVoted?: boolean;
  userVoteOption?: string;
  votersCount?: number;
  isExpired?: boolean;
  displayLocations?: string[];
  hideVoteCounts?: boolean;   // ✅ NEW
}

const getDeviceId = (): string => {
  if (typeof window === 'undefined') return 'server';
  try {
    let deviceId = localStorage.getItem('poll_device_id');
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem('poll_device_id', deviceId);
    }
    return deviceId;
  } catch (e) {
    return `fallback-${Math.random().toString(36).substring(2, 15)}`;
  }
};

const deviceId = getDeviceId();

const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' | 'unknown' => {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua) || (/(android|touch)/i.test(ua) && !/mobile/i.test(ua))) return 'tablet';
  return 'desktop';
};

const deviceType = getDeviceType();

const setLocalVoteStatus = (pollId: string, optionId?: string) => {
  if (typeof window === 'undefined') return;
  try {
    const votedPolls = JSON.parse(localStorage.getItem('votedPolls') || '{}');
    votedPolls[pollId] = { voted: true, optionId, timestamp: Date.now() };
    localStorage.setItem('votedPolls', JSON.stringify(votedPolls));
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
};

const makeTextClickable = (text: string): React.ReactNode[] => {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<]+)/gi;
  const lines = text.split('\n');
  return lines.map((line, lineIndex) => {
    const parts = line.split(urlRegex);
    return (
      <React.Fragment key={lineIndex}>
        {parts.map((part, i) => {
          if (part.match(urlRegex)) {
            return (
              <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 break-words">
                {part}
              </a>
            );
          }
          return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

const AvatarFallback = () => (
  <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-xs font-bold text-gray-300">
    A
  </div>
);

// ✅ NEW — single poll ka poora UI + voting logic, per-poll isolated state ke saath
const SinglePollCard: React.FC<{ poll: Poll; onVoteSuccess?: () => void; onRefresh: () => void }> = ({ poll, onVoteSuccess, onRefresh }) => {
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(!!poll.userHasVoted);
  const [selectedOption, setSelectedOption] = useState<string | null>(poll.userVoteOption || null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setHasVoted(!!poll.userHasVoted);
    setSelectedOption(poll.userVoteOption || null);
  }, [poll.userHasVoted, poll.userVoteOption]);

  const handleVote = async (optionId: string) => {
    if (hasVoted || voting) return;
    if (!deviceId || deviceId === 'server') {
      alert('Device identifier not available. Please refresh.');
      return;
    }

    setVoting(true);
    setSelectedOption(optionId);

    try {
      const res = await fetch(`${API_BASE_URL}/polls/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ pollId: poll._id, optionId, deviceId, deviceType }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.message?.toLowerCase().includes('already voted')) {
          setHasVoted(true);
          setLocalVoteStatus(poll._id, optionId);
          return;
        }
        throw new Error(result.message || 'Vote failed');
      }

      setHasVoted(true);
      setLocalVoteStatus(poll._id, optionId);
      if (onVoteSuccess) onVoteSuccess();
      onRefresh();
    } catch (err: any) {
      console.error('❌ Vote error:', err);
      alert('Failed to vote. Please try again.');
    } finally {
      setVoting(false);
    }
  };

  const totalVotes = poll.totalVotes || poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);

  return (
    <div className="w-full bg-[#1a1a1a] rounded-lg border border-gray-700 overflow-hidden mb-4">
      <div className="flex items-center px-3 pt-2 pb-2 bg-gray-800/30 border-b border-gray-800 rounded-t-lg">
        {avatarError ? (
          <AvatarFallback />
        ) : (
          <img
            src="/skull,logo.jpeg"
            alt="Admin avatar"
            className="w-8 h-8 rounded-full object-cover border border-gray-600"
            onError={() => setAvatarError(true)}
          />
        )}
        <div className="ml-2 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">Admin</span>
          <span className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded-full font-semibold leading-none">
            Creater
          </span>
        </div>
      </div>

      <div className="px-3 pt-2 pb-3">
        <h3 className="text-sm font-semibold text-gray-100 break-words whitespace-pre-line">
          {makeTextClickable(poll.question)}
        </h3>
      </div>

      <div className="px-2 pb-3 space-y-2 pt-2">
        {poll.options.map(opt => {
          const percentage = opt.percentage || 0;
          const isSelected = selectedOption === opt._id;
          const isUserVote = hasVoted && selectedOption === opt._id;

          return (
            <div
              key={opt._id}
              onClick={() => !hasVoted && !voting && handleVote(opt._id)}
              className={`relative rounded-md transition-all duration-200 border ${
                hasVoted
                  ? isUserVote
                    ? 'cursor-default bg-gray-800 border-gray-600 ring-1 ring-gray-600'
                    : 'cursor-default bg-[#222222] border-gray-700'
                  : voting && isSelected
                  ? 'cursor-not-allowed bg-gray-800 border-gray-600 ring-1 ring-gray-600'
                  : 'cursor-pointer hover:bg-gray-800 hover:border-gray-600 border-gray-700'
              } ${isSelected && voting ? 'ring-2 ring-blue-500' : ''}`}
              style={{ padding: hasVoted ? '0.2rem 0.5rem 0.2rem 0.2rem' : '0.2rem' }}
            >
              {/* ✅ Bar hamesha dikhega jab vote ho chuka ho — chahe hideVoteCounts ON ho ya OFF */}
              {hasVoted && (
                <div className="absolute inset-0 bg-gray-800 rounded-md overflow-hidden">
                  <div className="h-full bg-gray-700 transition-all duration-700 ease-out" style={{ width: `${percentage}%` }} />
                </div>
              )}

              <div className="relative flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  <div className="flex-shrink-0 w-16 h-16 md:w-18 md:h-18 overflow-hidden rounded-md border border-gray-700">
                    <img
                      src={opt.image || 'https://via.placeholder.com/64x64?text=No+Image'}
                      alt={opt.title}
                      className="w-full h-full object-cover"
                      onError={e => (e.currentTarget.src = 'https://via.placeholder.com/64x64?text=No+Image')}
                    />
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <span className="text-xs md:text-sm font-medium text-gray-300 break-words whitespace-normal block">
                      {makeTextClickable(opt.title)}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 ml-2">
                  {!hasVoted ? (
                    isSelected && voting ? (
                      <div className="flex items-center">
                        <svg className="animate-spin h-4 w-4 md:h-5 md:w-5 mr-1 text-gray-300" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    ) : null
                  ) : (
                    <div className="flex items-center">
                      {isUserVote && <span className="text-xs text-green-400 mr-2 font-medium">✓</span>}
                      {/* ✅ Percentage hamesha dikhega */}
                      <span className="text-sm md:text-base font-bold text-gray-300">{percentage}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-gray-800">
        <div className="flex justify-between items-center">
          {/* ✅ sirf total-votes number hide hota hai, jab hideVoteCounts ON ho */}
          {!poll.hideVoteCounts ? (
            <span className="text-xs text-gray-500">
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </span>
          ) : <span />}
          {!hasVoted && !voting && <span className="text-xs text-gray-400">Click to vote</span>}
        </div>
      </div>
    </div>
  );
};

interface PollCardProps {
  onVoteSuccess?: () => void;
  // ✅ NEW — kis page pe render ho raha hai, sirf usi location ke liye enabled polls fetch honge
  location: 'home' | 'detail' | 'downloadLink';
}

const PollCard: React.FC<PollCardProps> = ({ onVoteSuccess, location }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPolls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/polls/active?deviceId=${encodeURIComponent(deviceId)}&location=${encodeURIComponent(location)}`, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-cache',
      });

      if (res.status === 404) {
        setPolls([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const list: Poll[] = data.polls || (data.poll ? [data.poll] : []);

      const now = new Date();
      const valid = list.filter(p => p.isActive && (!p.expiresAt || new Date(p.expiresAt) >= now));

      const withPercentage = valid.map(p => {
        const totalVotes = p.totalVotes || 0;
        return {
          ...p,
          options: p.options.map(opt => ({
            ...opt,
            votes: opt.votes || 0,
            percentage: totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0,
          })),
        };
      });

      setPolls(withPercentage);
    } catch (err: any) {
      console.error('❌ Error loading polls:', err);
      setError('Failed to load polls');
      setPolls([]);
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  // ✅ Auto-refresh sirf tab jab koi poll ho jisme user ne vote nahi kiya
  useEffect(() => {
    const anyUnvoted = polls.some(p => !p.userHasVoted);
    if (anyUnvoted) {
      const interval = setInterval(loadPolls, 30000);
      return () => clearInterval(interval);
    }
  }, [polls, loadPolls]);

  if (loading && polls.length === 0) return <div className="p-4 bg-[#1a1a1a] rounded-lg border border-gray-700 animate-pulse">Loading...</div>;
  if (error || polls.length === 0) return null;

  return (
    <>
      {polls.map(poll => (
        <SinglePollCard key={poll._id} poll={poll} onVoteSuccess={onVoteSuccess} onRefresh={loadPolls} />
      ))}
    </>
  );
};

export default PollCard;
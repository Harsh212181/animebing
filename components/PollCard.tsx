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
}

interface VoteResponse {
  success: boolean;
  message?: string;
  totalVotes: number;
  optionVotes: number;
  userHasVoted?: boolean;
  userVoteOption?: string;
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

interface VoteStatus {
  voted: boolean;
  optionId?: string;
  timestamp?: number;
}

const getLocalVoteStatus = (pollId: string): VoteStatus | false => {
  if (typeof window === 'undefined') return false;
  try {
    const votedPolls = JSON.parse(localStorage.getItem('votedPolls') || '{}');
    const voteData = votedPolls[pollId];
    if (typeof voteData === 'boolean') return { voted: voteData };
    return voteData || false;
  } catch {
    return false;
  }
};

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

// ✅ FIX: previously this only linkified URLs but ignored newlines, so numbered
// points typed like "1. abc\n2. def" collapsed onto one line. Now it splits by
// line first (so each point renders on its own line, stacked vertically — same
// on mobile and PC since the card is always single-column) and still linkifies
// any URLs within each line.
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

interface PollCardProps {
  onVoteSuccess?: () => void;
}

const PollCard: React.FC<PollCardProps> = ({ onVoteSuccess }) => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [userVoteOption, setUserVoteOption] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const loadPoll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/polls/active?deviceId=${encodeURIComponent(deviceId)}`, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-cache',
      });

      if (res.status === 404) {
        setPoll(null);
        setIsActive(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!data.success || !data.poll) {
        setPoll(null);
        setIsActive(false);
        return;
      }

      const pollData = data.poll;
      if (!pollData.isActive || (pollData.expiresAt && new Date(pollData.expiresAt) < new Date())) {
        setPoll(null);
        setIsActive(false);
        return;
      }

      const userHasVoted = pollData.userHasVoted || false;
      const userVoteOption = pollData.userVoteOption || null;

      if (userHasVoted) {
        setHasVoted(true);
        setUserVoteOption(userVoteOption);
        setSelectedOption(userVoteOption);
        setLocalVoteStatus(pollData._id, userVoteOption);
      } else {
        setHasVoted(false);
        setUserVoteOption(null);
        setSelectedOption(null);
      }

      const totalVotes = pollData.totalVotes || 0;
      const optionsWithPercentage = pollData.options.map((opt: any) => ({
        ...opt,
        votes: opt.votes || 0,
        percentage: totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0,
      }));

      setPoll({ ...pollData, userHasVoted, userVoteOption, options: optionsWithPercentage });
      setIsActive(true);
    } catch (err: any) {
      console.error('❌ Error loading poll:', err);
      setError('Failed to load poll');
      setIsActive(false);
      setPoll(null);
    } finally {
      setLoading(false);
    }
  }, []); // stable reference

  // Initial poll load on mount
  useEffect(() => {
    loadPoll();
  }, []);

  // Auto-refresh if poll is active and user hasn't voted
  useEffect(() => {
    if (!hasVoted && isActive) {
      const interval = setInterval(loadPoll, 30000);
      return () => clearInterval(interval);
    }
  }, [hasVoted, isActive, loadPoll]);

  const handleVote = async (optionId: string) => {
    if (!poll || hasVoted || voting) return;
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

      const result: VoteResponse = await res.json();

      if (!res.ok) {
        if (result.message?.toLowerCase().includes('already voted')) {
          setHasVoted(true);
          setLocalVoteStatus(poll._id, optionId);
          // Already voted, no need to reload
          return;
        }
        throw new Error(result.message || 'Vote failed');
      }

      // ✅ Vote successful: update state and then reload fresh data
      setHasVoted(true);
      setUserVoteOption(optionId);
      setLocalVoteStatus(poll._id, optionId);
      if (onVoteSuccess) onVoteSuccess();

      // Fresh data lo backend se - correct percentages ke liye
      await loadPoll();

    } catch (err: any) {
      console.error('❌ Vote error:', err);
      alert('Failed to vote. Please try again.');
    } finally {
      setVoting(false);
    }
  };

  if (!isActive) return null;
  if (loading) return <div className="p-4 bg-[#1a1a1a] rounded-lg border border-gray-700 animate-pulse">Loading...</div>;
  if (error || !poll) return null;

  const totalVotes = poll.totalVotes || poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
  const isUserVoteOption = userVoteOption || poll.userVoteOption;

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
        {/* ✅ whitespace-pre-line + line-aware rendering so numbered points (1. .. / 2. ..)
            each show on their own line, same on mobile & desktop */}
        <h3 className="text-sm font-semibold text-gray-100 break-words whitespace-pre-line">
          {makeTextClickable(poll.question)}
        </h3>
      </div>

      <div className="px-2 pb-3 space-y-2 pt-2">
        {poll.options.map(opt => {
          const percentage = opt.percentage || 0;
          const isSelected = selectedOption === opt._id;
          const isUserVote = hasVoted && isUserVoteOption === opt._id;

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
          <span className="text-xs text-gray-500">
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </span>
          {!hasVoted && !voting && <span className="text-xs text-gray-400">Click to vote</span>}
        </div>
      </div>
    </div>
  );
};

export default PollCard;
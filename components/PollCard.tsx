 // components/PollCard.tsx - Production Ready
import React, { useEffect, useState } from 'react';

/* =========================
   API CONFIGURATION - FIXED
========================= */
const API_BASE_URL =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.PROD
    ? 'https://animabing.onrender.com/api'
    : 'http://localhost:3000/api');

console.log("🌍 API BASE:", API_BASE_URL);

/* =========================
   TYPES
========================= */
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

interface VoteStatus {
  voted: boolean;
  optionId?: string;
  timestamp?: number;
}

/* =========================
   LOCAL STORAGE HELPERS
========================= */
const getVoteStatus = (pollId: string): VoteStatus | false => {
  if (typeof window === 'undefined') return false;
  try {
    const votedPolls = JSON.parse(localStorage.getItem('votedPolls') || '{}');
    const voteData = votedPolls[pollId];
    
    if (typeof voteData === 'boolean') {
      return { voted: voteData };
    }
    
    return voteData || false;
  } catch (error) {
    return false;
  }
};

const setVoteStatus = (pollId: string, optionId?: string) => {
  if (typeof window === 'undefined') return;
  try {
    const votedPolls = JSON.parse(localStorage.getItem('votedPolls') || '{}');
    votedPolls[pollId] = {
      voted: true,
      optionId: optionId,
      timestamp: Date.now()
    };
    localStorage.setItem('votedPolls', JSON.stringify(votedPolls));
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
};

/* =========================
   COMPONENT
========================= */
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

  /* =========================
     FETCH ACTIVE POLL
  ========================= */
  const loadPoll = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use relative path in production, absolute in development
      const endpoint = import.meta.env.PROD 
        ? '/api/poll/active'
        : `${API_BASE_URL}/poll/active`;
      
      console.log('🔄 Fetching from:', endpoint);
      
      const res = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-cache'
      });
      
      if (res.status === 404) {
        console.log('📭 No active poll found');
        setPoll(null);
        setIsActive(false);
        return;
      }
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!data.success || !data.poll) {
        setPoll(null);
        setIsActive(false);
        return;
      }

      const pollData = data.poll;
      
      // Check if poll is active and not expired
      if (!pollData.isActive) {
        setPoll(null);
        setIsActive(false);
        return;
      }
      
      if (pollData.expiresAt) {
        const expireDate = new Date(pollData.expiresAt);
        const now = new Date();
        if (expireDate < now) {
          setPoll(null);
          setIsActive(false);
          return;
        }
      }
      
      // Get vote status
      const localStorageVote = getVoteStatus(pollData._id);
      
      const userHasVoted = pollData.userHasVoted || 
        (localStorageVote && (localStorageVote as VoteStatus).voted) || 
        false;
      
      const userVoteOption = pollData.userVoteOption || 
        (localStorageVote && (localStorageVote as VoteStatus).optionId) || 
        null;
      
      if (userHasVoted) {
        setHasVoted(true);
        setUserVoteOption(userVoteOption);
        setSelectedOption(userVoteOption);
        
        if (!localStorageVote && userVoteOption) {
          setVoteStatus(pollData._id, userVoteOption);
        }
      } else {
        setHasVoted(false);
        setUserVoteOption(null);
        setSelectedOption(null);
      }
      
      // Calculate percentages
      const totalVotes = pollData.totalVotes || 0;
      const optionsWithPercentage = pollData.options.map((opt: any) => {
        const votes = opt.votes || 0;
        const percentage = totalVotes > 0 
          ? Math.round((votes / totalVotes) * 100)
          : 0;
        
        return {
          ...opt,
          votes: votes,
          percentage: percentage
        };
      });

      const processedPoll = {
        ...pollData,
        userHasVoted,
        userVoteOption,
        options: optionsWithPercentage
      };

      setPoll(processedPoll);
      setIsActive(true);
      
    } catch (err: any) {
      console.error('❌ Error loading poll:', err);
      setError('Failed to load poll');
      setIsActive(false);
      setPoll(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPoll();
    
    // Auto-refresh every 30 seconds if not voted
    if (!hasVoted && isActive) {
      const interval = setInterval(loadPoll, 30000);
      return () => clearInterval(interval);
    }
  }, [hasVoted, isActive]);

  /* =========================
     VOTE HANDLER
  ========================= */
  const handleVote = async (optionId: string) => {
    if (!poll || hasVoted || voting) return;

    setVoting(true);
    setSelectedOption(optionId);

    try {
      // Use relative path in production, absolute in development
      const endpoint = import.meta.env.PROD 
        ? '/api/poll/vote'
        : `${API_BASE_URL}/poll/vote`;
      
      console.log('🗳️ Voting via:', endpoint);
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          pollId: poll._id,
          optionId,
        }),
      });

      const result: VoteResponse = await res.json();
      
      if (!res.ok) {
        if (result.message?.includes('already voted') || result.message?.includes('Already voted')) {
          setHasVoted(true);
          setVoteStatus(poll._id, optionId);
          loadPoll();
          return;
        }
        throw new Error(result.message || 'Vote failed');
      }

      const updatedPoll = { ...poll };
      const newTotalVotes = result.totalVotes;
      updatedPoll.totalVotes = newTotalVotes;
      updatedPoll.userHasVoted = true;
      updatedPoll.userVoteOption = optionId;
      
      // Recalculate percentages
      updatedPoll.options = updatedPoll.options.map((option) => {
        const currentVotes = option._id === optionId 
          ? result.optionVotes 
          : option.votes;
        
        const newPercentage = newTotalVotes > 0 
          ? Math.round((currentVotes / newTotalVotes) * 100)
          : 0;
        
        return {
          ...option,
          votes: currentVotes,
          percentage: newPercentage
        };
      });

      setPoll(updatedPoll);
      setHasVoted(true);
      setUserVoteOption(optionId);
      setVoteStatus(poll._id, optionId);
      
      if (onVoteSuccess) {
        onVoteSuccess();
      }
    } catch (err: any) {
      console.error('❌ Vote error:', err);
      alert('Failed to vote. Please try again.');
    } finally {
      setVoting(false);
    }
  };

  /* =========================
     RENDER STATES
  ========================= */
  if (!isActive) {
    return null;
  }

  if (loading) {
    return (
      <div className="w-full p-4 bg-[#1a1a1a] rounded-lg border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !poll) {
    return null;
  }

  /* =========================
     RENDER POLL
  ========================= */
  const totalVotes = poll.totalVotes || poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
  const isUserVoteOption = userVoteOption || poll.userVoteOption;

  return (
    <div className="w-full bg-[#1a1a1a] rounded-lg border border-gray-700 overflow-hidden mb-4">
      {/* POLL HEADER */}
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-100 leading-tight">
          {poll.question}
        </h3>
      </div>

      {/* OPTIONS */}
      <div className="px-2 pb-3 space-y-2 pt-2">
        {poll.options.map((opt) => {
          const votes = opt.votes || 0;
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
              style={{ 
                padding: hasVoted ? '0.2rem 0.5rem 0.2rem 0.2rem' : '0.2rem'
              }}
            >
              {/* Progress Bar */}
              {hasVoted && (
                <div className="absolute inset-0 bg-gray-800 rounded-md overflow-hidden">
                  <div
                    className="h-full bg-gray-700 transition-all duration-700 ease-out"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              )}

              {/* Option Content */}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  <div className="flex-shrink-0 w-16 h-16 md:w-18 md:h-18 overflow-hidden rounded-md border border-gray-700">
                    <img
                      src={opt.image || 'https://via.placeholder.com/64x64?text=No+Image'}
                      alt={opt.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x64?text=No+Image';
                      }}
                    />
                  </div>
                  
                  <div className="ml-3 flex-1 min-w-0">
                    <span className={`text-xs md:text-sm font-medium truncate block text-gray-300`}>
                      {opt.title}
                    </span>
                  </div>
                </div>
                
                <div className="flex-shrink-0 ml-2">
                  {!hasVoted ? (
                    isSelected && voting ? (
                      <div className="flex items-center">
                        <svg className="animate-spin h-4 w-4 md:h-5 md:w-5 mr-1 text-gray-300" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                      </div>
                    ) : null
                  ) : (
                    <div className="flex items-center">
                      {isUserVote && (
                        <span className="text-xs text-green-400 mr-2 font-medium">✓</span>
                      )}
                      <span className="text-sm md:text-base font-bold text-gray-300">
                        {percentage}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="px-3 py-2 border-t border-gray-800">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </span>
          {!hasVoted && !voting && (
            <span className="text-xs text-gray-400">Click to vote</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PollCard;
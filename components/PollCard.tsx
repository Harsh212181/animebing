 import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface PollOption {
  _id: string;
  title: string;
  animeId?: string | null;
  image?: string;
  votes: number;
  order: number;
  percentage?: number;
  isCustom?: boolean;
}

interface Poll {
  _id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  expiresAt: string;
  isActive: boolean;
  userHasVoted?: boolean;
  userVoteOption?: string | null;
  isExpired?: boolean;
  votersCount?: number;
}

interface PollResponse {
  success: boolean;
  poll: Poll | null;
  message?: string;
}

interface VoteResponse {
  success: boolean;
  totalVotes: number;
  optionVotes: number;
  userHasVoted: boolean;
  userVoteOption: string;
  message?: string;
}

// ----------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------

const API_BASE_URL = 'https://animabing.onrender.com/api';
const POLLS_ENDPOINT = `${API_BASE_URL}/poll`;

// ----------------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------------

const formatTimeRemaining = (expiresAt: string): string => {
  const total = new Date(expiresAt).getTime() - Date.now();
  if (total <= 0) return 'Expired';

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m ${seconds}s remaining`;
  return `${seconds}s remaining`;
};

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

const PollCard: React.FC = () => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isVoting, setIsVoting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteSuccess, setVoteSuccess] = useState(false);

  // --------------------------------------------------------------------
  // Fetch active poll on mount
  // --------------------------------------------------------------------
  useEffect(() => {
    fetchActivePoll();
  }, []);

  const fetchActivePoll = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${POLLS_ENDPOINT}/active`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: PollResponse = await res.json();

      if (data.success && data.poll) {
        // Calculate percentages if not already done by backend
        const pollWithPercentages = {
          ...data.poll,
          options: data.poll.options.map((opt) => ({
            ...opt,
            percentage:
              data.poll!.totalVotes > 0
                ? Math.round((opt.votes / data.poll!.totalVotes) * 100)
                : 0,
          })),
        };
        setPoll(pollWithPercentages);
        // If user already voted, we don't need to preselect anything for voting
        if (pollWithPercentages.userHasVoted) {
          setSelectedOption(pollWithPercentages.userVoteOption || '');
        }
      } else {
        setPoll(null); // No active poll
      }
    } catch (err) {
      console.error('Failed to fetch poll:', err);
      setError('Could not load poll. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------
  // Vote handler
  // --------------------------------------------------------------------
  const handleVote = async () => {
    if (!poll || !selectedOption || isVoting) return;

    setIsVoting(true);
    setError(null);
    setVoteSuccess(false);

    try {
      const res = await fetch(`${POLLS_ENDPOINT}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollId: poll._id,
          optionId: selectedOption,
        }),
      });

      const data: VoteResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Vote failed');
      }

      // On success, refresh poll to get updated results and userVoted flag
      await fetchActivePoll();
      setVoteSuccess(true);
    } catch (err: any) {
      console.error('Vote error:', err);
      setError(err.message || 'Failed to submit vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  // --------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------
  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
        <div className="h-6 bg-gray-800 rounded w-3/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-5 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchActivePoll}
          className="mt-3 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!poll) {
    return null; // No active poll – hide component entirely
  }

  const isExpired = poll.isExpired || new Date(poll.expiresAt) < new Date();
  const hasVoted = poll.userHasVoted === true;
  const showResults = hasVoted || isExpired || voteSuccess;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-5 shadow-xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="bg-blue-600 w-1.5 h-6 rounded-full"></span>
          Community Poll
        </h3>
        <div className="flex items-center text-xs text-gray-400 bg-gray-800/60 px-3 py-1.5 rounded-full">
          <Clock className="h-3.5 w-3.5 mr-1.5" />
          {isExpired ? 'Poll ended' : formatTimeRemaining(poll.expiresAt)}
        </div>
      </div>

      {/* Question */}
      <h4 className="text-white text-md md:text-lg font-medium mb-4 leading-tight">
        {poll.question}
      </h4>

      {/* Options */}
      <div className="space-y-3 mb-4">
        {poll.options
          .sort((a, b) => a.order - b.order)
          .map((option) => {
            const isSelected = selectedOption === option._id;
            const isUserVote = hasVoted && option._id === poll.userVoteOption;
            const percentage = option.percentage ?? 0;

            return (
              <div key={option._id}>
                {showResults ? (
                  // ---------- RESULT VIEW ----------
                  <div
                    className={`relative overflow-hidden rounded-xl border ${
                      isUserVote
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-800 bg-gray-800/30'
                    }`}
                  >
                    <div
                      className="absolute inset-0 bg-blue-600/20 origin-left transition-all duration-700"
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="relative flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {option.image ? (
                          <img
                            src={option.image}
                            alt=""
                            className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-gray-700 flex-shrink-0" />
                        )}
                        <span className="text-sm text-white truncate">
                          {option.title}
                        </span>
                        {isUserVote && (
                          <CheckCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                        <span className="text-sm font-medium text-white">
                          {option.votes}
                        </span>
                        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // ---------- VOTING VIEW ----------
                  <label
                    className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-gray-800 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pollOption"
                      value={option._id}
                      checked={isSelected}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      className="h-4 w-4 text-blue-600 border-gray-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                    />
                    <div className="flex items-center gap-3 ml-3 flex-1 min-w-0">
                      {option.image ? (
                        <img
                          src={option.image}
                          alt=""
                          className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-gray-700 flex-shrink-0" />
                      )}
                      <span className="text-sm text-white truncate">
                        {option.title}
                      </span>
                    </div>
                  </label>
                )}
              </div>
            );
          })}
      </div>

      {/* Vote button / Already voted message / Expired message */}
      <AnimatePresence mode="wait">
        {!showResults ? (
          <motion.button
            key="vote"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleVote}
            disabled={!selectedOption || isVoting}
            className={`w-full py-2.5 rounded-lg font-medium transition flex items-center justify-center ${
              !selectedOption || isVoting
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
            }`}
          >
            {isVoting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Voting...
              </>
            ) : (
              'Submit Vote'
            )}
          </motion.button>
        ) : isExpired ? (
          <motion.div
            key="expired"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-gray-400 text-sm py-2"
          >
            This poll has ended · {poll.totalVotes} total votes
          </motion.div>
        ) : hasVoted ? (
          <motion.div
            key="voted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-green-400 text-sm py-2 flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="h-4 w-4" />
            You voted · {poll.totalVotes} total votes
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Error message inside card */}
      {error && (
        <div className="mt-3 text-xs text-red-400 bg-red-900/20 p-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </motion.div>
  );
};

export default PollCard;
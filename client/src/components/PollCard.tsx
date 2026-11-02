import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { BarChart3, CheckCircle2, Lock, Play, Pause, Trash2, Users } from 'lucide-react';
import { Poll } from '../types/index.js';

interface PollCardProps {
  poll: Poll;
  isHost?: boolean;
  onVote?: (pollId: string, optionId: string) => Promise<void>;
  onUpdateStatus?: (pollId: string, updates: { status?: 'draft' | 'active' | 'closed'; show_results?: boolean }) => void;
  onDelete?: (pollId: string) => void;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  isHost = false,
  onVote,
  onUpdateStatus,
  onDelete
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  const hasVoted = Boolean(poll.user_voted_option_id);
  const isActive = poll.status === 'active';
  const isClosed = poll.status === 'closed';
  const isDraft = poll.status === 'draft';
  const showResults = poll.show_results || isHost || hasVoted;

  const handleVote = async (optionId: string) => {
    if (!onVote || hasVoted || !isActive || isSubmittingVote) return;
    try {
      setIsSubmittingVote(true);
      await onVote(poll.id, optionId);
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.7 }
      });
    } finally {
      setIsSubmittingVote(false);
    }
  };

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl border transition-all ${
        isActive
          ? 'bg-white border-brand-200/80 shadow-md ring-1 ring-brand-100'
          : isClosed
          ? 'bg-slate-50/80 border-slate-200 opacity-90'
          : 'bg-white border-slate-200 shadow-xs'
      }`}
    >
      {/* Header status bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Live Voting Active</span>
            </span>
          ) : isClosed ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              <Lock className="w-3 h-3" />
              <span>Voting Closed</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <span>Draft</span>
            </span>
          )}

          {hasVoted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
              <CheckCircle2 className="w-3 h-3" />
              <span>You voted</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
          <Users className="w-3.5 h-3.5" />
          <span>{poll.total_votes || 0} votes</span>
        </div>
      </div>

      {/* Question */}
      <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug mb-4">
        {poll.question}
      </h4>

      {/* Options List */}
      <div className="space-y-2.5">
        {poll.options?.map((option) => {
          const isUserChoice = poll.user_voted_option_id === option.id;
          const percentage = option.percentage || 0;

          // If results are visible or user has voted, render the live animated results bar
          if (showResults || isHost) {
            return (
              <div
                key={option.id}
                className={`relative overflow-hidden p-3.5 rounded-xl border transition-all ${
                  isUserChoice
                    ? 'border-brand-500 bg-brand-50/20'
                    : 'border-slate-200/80 bg-slate-50/50'
                }`}
              >
                {/* Live Animated Background Fill Bar */}
                <div
                  className={`absolute inset-y-0 left-0 poll-bar-transition ${
                    isUserChoice
                      ? 'bg-gradient-to-r from-brand-500/20 to-brand-500/10'
                      : 'bg-slate-200/50'
                  }`}
                  style={{ width: `${percentage}%` }}
                />

                <div className="relative flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    {isUserChoice && (
                      <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                    )}
                    <span className="break-words">{option.text}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                    <span className="text-slate-500">{option.votes_count} votes</span>
                    <span className="font-bold text-slate-900 w-10 text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // If audience hasn't voted yet and poll is active, show selectable choice
          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={isSubmittingVote || !isActive}
              className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-sm font-medium ${
                selectedOptionId === option.id
                  ? 'border-brand-500 bg-brand-50/30 text-brand-900 ring-2 ring-brand-500/20'
                  : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50/70 text-slate-800'
              } active:scale-[0.99] cursor-pointer`}
            >
              <span>{option.text}</span>
              <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center shrink-0 group-hover:border-brand-500">
                {selectedOptionId === option.id && (
                  <div className="w-2 h-2 rounded-full bg-brand-600" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Host Controls */}
      {isHost && onUpdateStatus && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isActive ? (
              <button
                onClick={() => onUpdateStatus(poll.id, { status: 'closed' })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Close Voting</span>
              </button>
            ) : (
              <button
                onClick={() => onUpdateStatus(poll.id, { status: 'active' })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Activate Poll</span>
              </button>
            )}

            <button
              onClick={() => onUpdateStatus(poll.id, { show_results: !poll.show_results })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5 text-brand-600" />
              <span>{poll.show_results ? 'Hide Audience Bars' : 'Show Audience Bars'}</span>
            </button>
          </div>

          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Delete this poll and its voting data?')) {
                  onDelete(poll.id);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete poll"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

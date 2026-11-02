import React from 'react';
import { ThumbsUp, Check, EyeOff, Eye, Pin, Trash2, Shield, User } from 'lucide-react';
import { Question } from '../types/index.js';

interface QuestionCardProps {
  question: Question;
  isHost?: boolean;
  onUpvote?: (questionId: string) => void;
  onRemoveUpvote?: (questionId: string) => void;
  onModerate?: (questionId: string, updates: { is_answered?: number; is_hidden?: number; is_pinned?: number }) => void;
  onDelete?: (questionId: string) => void;
  isVoting?: boolean;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  isHost = false,
  onUpvote,
  onRemoveUpvote,
  onModerate,
  onDelete,
  isVoting = false
}) => {
  const handleVoteClick = () => {
    if (question.has_voted) {
      if (onRemoveUpvote) onRemoveUpvote(question.id);
    } else {
      if (onUpvote) onUpvote(question.id);
    }
  };

  const isPinned = question.is_pinned === 1;
  const isAnswered = question.is_answered === 1;
  const isHidden = question.is_hidden === 1;

  return (
    <div
      className={`relative group p-4 sm:p-5 rounded-2xl transition-all border duration-200 ${
        isPinned
          ? 'bg-gradient-to-r from-brand-50/60 via-indigo-50/40 to-white border-brand-300 shadow-md ring-1 ring-brand-300/50'
          : isAnswered
          ? 'bg-slate-50/70 border-slate-200/80 opacity-80'
          : isHidden
          ? 'bg-rose-50/40 border-rose-200 opacity-60'
          : 'bg-white border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300'
      }`}
    >
      {/* Top Banner Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        {isPinned && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-600 text-white shadow-xs">
            <Pin className="w-3 h-3 rotate-45" />
            <span>Spotlighted on Stage</span>
          </span>
        )}

        {isAnswered && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            <Check className="w-3 h-3" />
            <span>Answered</span>
          </span>
        )}

        {isHidden && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
            <EyeOff className="w-3 h-3" />
            <span>Hidden from Audience</span>
          </span>
        )}
      </div>

      <div className="flex items-start gap-3.5">
        {/* Upvote Control */}
        <button
          onClick={handleVoteClick}
          disabled={isVoting || isAnswered || isHidden}
          className={`shrink-0 flex flex-col items-center justify-center min-w-[3.5rem] py-2 px-2.5 rounded-xl border transition-all select-none active:scale-95 ${
            question.has_voted
              ? 'bg-brand-600 border-brand-600 text-white shadow-sm shadow-brand-500/30'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-600'
          } ${isAnswered ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          title={question.has_voted ? 'Click to unvote' : 'Click to upvote'}
        >
          <ThumbsUp
            className={`w-4 h-4 mb-0.5 transition-transform ${
              question.has_voted ? 'fill-white stroke-white scale-110' : 'group-hover:scale-110'
            }`}
          />
          <span className="font-mono text-xs font-bold leading-tight">
            {question.upvotes_count}
          </span>
        </button>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-medium text-slate-900 leading-snug break-words mb-2">
            {question.content}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {/* Author */}
            <div className="flex items-center gap-1 font-semibold text-slate-700">
              {question.is_anonymous ? (
                <>
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span className="italic text-slate-500">Anonymous</span>
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5 text-brand-500" />
                  <span>{question.author_name}</span>
                </>
              )}
            </div>

            <span className="text-slate-300">•</span>

            {/* Time */}
            <span className="text-slate-400">
              {timeAgo(question.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Host Moderation Controls */}
      {isHost && onModerate && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Mark Answered */}
            <button
              onClick={() => onModerate(question.id, { is_answered: isAnswered ? 0 : 1 })}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                isAnswered
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isAnswered ? 'Mark Unanswered' : 'Answered'}</span>
            </button>

            {/* Spotlight / Pin */}
            <button
              onClick={() => onModerate(question.id, { is_pinned: isPinned ? 0 : 1 })}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                isPinned
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Pin className="w-3.5 h-3.5 rotate-45" />
              <span>{isPinned ? 'Unpin' : 'Spotlight'}</span>
            </button>

            {/* Hide / Unhide */}
            <button
              onClick={() => onModerate(question.id, { is_hidden: isHidden ? 0 : 1 })}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                isHidden
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{isHidden ? 'Unhide' : 'Hide'}</span>
            </button>
          </div>

          {/* Delete */}
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Delete this question permanently?')) {
                  onDelete(question.id);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-auto"
              title="Delete question"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

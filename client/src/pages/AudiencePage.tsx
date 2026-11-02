import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageSquare, BarChart3, Plus, Search, QrCode, Sparkles, Filter, CheckCircle2, AlertCircle
} from 'lucide-react';
import { api } from '../lib/api.js';
import { getSocket, joinSessionRoom } from '../lib/socket.js';
import { Session, Question, Poll } from '../types/index.js';
import { Navbar } from '../components/Navbar.js';
import { QuestionCard } from '../components/QuestionCard.js';
import { PollCard } from '../components/PollCard.js';
import { AskQuestionModal } from '../components/AskQuestionModal.js';
import { QRCodeModal } from '../components/QRCodeModal.js';
import { ToastContainer, ToastMessage } from '../components/Toast.js';

export const AudiencePage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'questions' | 'polls'>('questions');
  const [sortBy, setSortBy] = useState<'top' | 'newest' | 'answered'>('top');
  const [searchQuery, setSearchQuery] = useState('');

  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const participantId = localStorage.getItem('eventpulse_participant_id') || '';
  const displayName = localStorage.getItem('eventpulse_display_name') || 'Guest';

  const addToast = (type: 'error' | 'success' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initial Data Fetch & Registration Verification
  useEffect(() => {
    if (!code) return;
    const upperCode = code.toUpperCase();

    async function loadData() {
      try {
        setLoading(true);

        // Fetch session
        const sessRes = await api.getSession(upperCode);
        setSession(sessRes.session);

        // If user didn't register a display name yet, register them with a default or prompt
        let currentPid = participantId;
        if (!currentPid) {
          const defaultName = 'Guest Attendee';
          const joinRes = await api.joinSession(upperCode, defaultName);
          currentPid = joinRes.participant.id;
          localStorage.setItem('eventpulse_participant_id', currentPid);
          localStorage.setItem('eventpulse_display_name', defaultName);
        }

        // Fetch questions
        const qRes = await api.getQuestions(upperCode, currentPid);
        setQuestions(qRes.questions);

        // Fetch polls
        const pRes = await api.getPolls(upperCode, currentPid);
        setPolls(pRes.polls);

        // Connect WebSocket Room
        joinSessionRoom(upperCode, currentPid, displayName);
      } catch (err: any) {
        addToast('error', err.message || 'Session not found. Redirecting...');
        setTimeout(() => navigate('/'), 2500);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [code]);

  // Real-time WebSocket Event Subscriptions
  useEffect(() => {
    if (!code) return;
    const socket = getSocket();

    // 1. Participant counter
    const handleParticipantCount = (data: { count: number }) => {
      setParticipantCount(data.count);
    };

    // 2. Question created
    const handleQuestionCreated = (newQ: Question) => {
      setQuestions((prev) => {
        if (prev.some((q) => q.id === newQ.id)) return prev;
        return [newQ, ...prev];
      });
    };

    // 3. Question upvoted
    const handleQuestionUpvoted = (data: { questionId: string; upvotesCount: number }) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === data.questionId ? { ...q, upvotes_count: data.upvotesCount } : q))
      );
    };

    // 4. Question updated (moderated)
    const handleQuestionUpdated = (updatedQ: Question) => {
      setQuestions((prev) => {
        // If question was hidden by host, remove from audience list
        if (updatedQ.is_hidden === 1) {
          return prev.filter((q) => q.id !== updatedQ.id);
        }
        return prev.map((q) => (q.id === updatedQ.id ? { ...q, ...updatedQ } : q));
      });
    };

    // 5. Question deleted
    const handleQuestionDeleted = (data: { questionId: string }) => {
      setQuestions((prev) => prev.filter((q) => q.id !== data.questionId));
    };

    // 6. Poll created
    const handlePollCreated = (newPoll: Poll) => {
      setPolls((prev) => {
        if (prev.some((p) => p.id === newPoll.id)) return prev;
        return [newPoll, ...prev];
      });
    };

    // 7. Poll activated / updated
    const handlePollUpdated = (updatedPoll: Poll) => {
      setPolls((prev) =>
        prev.map((p) => (p.id === updatedPoll.id ? { ...p, ...updatedPoll } : p))
      );
    };

    // 8. Poll live votes
    const handlePollVoted = (data: { pollId: string; options: any[]; total_votes: number }) => {
      setPolls((prev) =>
        prev.map((p) => {
          if (p.id !== data.pollId) return p;
          return {
            ...p,
            total_votes: data.total_votes,
            options: data.options
          };
        })
      );
    };

    socket.on('session:participant_count', handleParticipantCount);
    socket.on('question:created', handleQuestionCreated);
    socket.on('question:upvoted', handleQuestionUpvoted);
    socket.on('question:updated', handleQuestionUpdated);
    socket.on('question:deleted', handleQuestionDeleted);
    socket.on('poll:created', handlePollCreated);
    socket.on('poll:activated', handlePollUpdated);
    socket.on('poll:updated', handlePollUpdated);
    socket.on('poll:voted', handlePollVoted);

    return () => {
      socket.off('session:participant_count', handleParticipantCount);
      socket.off('question:created', handleQuestionCreated);
      socket.off('question:upvoted', handleQuestionUpvoted);
      socket.off('question:updated', handleQuestionUpdated);
      socket.off('question:deleted', handleQuestionDeleted);
      socket.off('poll:created', handlePollCreated);
      socket.off('poll:activated', handlePollUpdated);
      socket.off('poll:updated', handlePollUpdated);
      socket.off('poll:voted', handlePollVoted);
    };
  }, [code]);

  // Actions
  const handleAskQuestion = async (content: string, isAnonymous: boolean) => {
    if (!code || !participantId) return;
    try {
      const res = await api.createQuestion(code, {
        content,
        participantId,
        isAnonymous
      });
      addToast('success', 'Your question has been posted!');
      // Optimistically add to state
      setQuestions((prev) => {
        if (prev.some((q) => q.id === res.question.id)) return prev;
        return [{ ...res.question, has_voted: false }, ...prev];
      });
    } catch (err: any) {
      addToast('error', err.message || 'Failed to submit question');
      throw err;
    }
  };

  const handleUpvote = async (questionId: string) => {
    if (!code || !participantId) return;

    // Optimistic UI update
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, upvotes_count: q.upvotes_count + 1, has_voted: true }
          : q
      )
    );

    try {
      await api.upvoteQuestion(code, questionId, participantId);
    } catch (err: any) {
      // Revert optimistic update on failure (e.g. server detected already voted)
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, upvotes_count: Math.max(0, q.upvotes_count - 1), has_voted: false }
            : q
        )
      );
      addToast('error', err.message || 'Only one vote per question is allowed');
    }
  };

  const handleRemoveUpvote = async (questionId: string) => {
    if (!code || !participantId) return;

    // Optimistic UI update
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, upvotes_count: Math.max(0, q.upvotes_count - 1), has_voted: false }
          : q
      )
    );

    try {
      await api.removeUpvote(code, questionId, participantId);
    } catch (err: any) {
      // Revert on error
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, upvotes_count: q.upvotes_count + 1, has_voted: true }
            : q
        )
      );
      addToast('error', err.message || 'Failed to remove upvote');
    }
  };

  const handleVotePoll = async (pollId: string, optionId: string) => {
    if (!code || !participantId) return;
    try {
      const res = await api.votePoll(code, pollId, optionId, participantId);
      // Update poll in state
      setPolls((prev) =>
        prev.map((p) => (p.id === pollId ? res.poll : p))
      );
      addToast('success', 'Vote recorded live!');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to submit poll vote');
      throw err;
    }
  };

  // Filtered & Sorted Questions
  const filteredQuestions = useMemo(() => {
    let list = [...questions];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => item.content.toLowerCase().includes(q) || item.author_name.toLowerCase().includes(q));
    }

    if (sortBy === 'top') {
      list.sort((a, b) => {
        // Spotlighted always first
        if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned;
        // Unanswered before answered
        if (a.is_answered !== b.is_answered) return a.is_answered - b.is_answered;
        // Most upvoted
        return b.upvotes_count - a.upvotes_count;
      });
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'answered') {
      list = list.filter((item) => item.is_answered === 1);
      list.sort((a, b) => b.upvotes_count - a.upvotes_count);
    }

    return list;
  }, [questions, sortBy, searchQuery]);

  // Active Poll
  const activePoll = useMemo(() => {
    return polls.find((p) => p.status === 'active');
  }, [polls]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Connecting to live session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24 sm:pb-12">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <Navbar
        sessionCode={session?.code}
        sessionTitle={session?.title}
        participantCount={participantCount}
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 pt-5">
        {/* Session Banner */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {session?.title}
              </h1>
              {session?.is_active === 0 && (
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md">
                  Ended
                </span>
              )}
            </div>
            {session?.description && (
              <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">
                {session.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              title="Show QR Code for joining"
            >
              <QrCode className="w-4 h-4 text-brand-600" />
              <span>Show QR</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher: Questions vs Polls */}
        <div className="flex items-center justify-between border-b border-slate-200 mb-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('questions')}
              className={`flex items-center gap-2 pb-3 px-3 border-b-2 font-bold text-sm transition-all ${
                activeTab === 'questions'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Questions</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-mono">
                {questions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('polls')}
              className={`flex items-center gap-2 pb-3 px-3 border-b-2 font-bold text-sm transition-all relative ${
                activeTab === 'polls'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Live Polls</span>
              {activePoll && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-mono">
                {polls.length}
              </span>
            </button>
          </div>

          {/* Desktop "Ask Question" Button */}
          {activeTab === 'questions' && (
            <button
              onClick={() => setIsAskModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Ask a Question</span>
            </button>
          )}
        </div>

        {/* QUESTIONS VIEW */}
        {activeTab === 'questions' && (
          <div>
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
              {/* Sort Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl">
                <button
                  onClick={() => setSortBy('top')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sortBy === 'top'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🔥 Top Voted
                </button>
                <button
                  onClick={() => setSortBy('newest')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sortBy === 'newest'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⏱️ Newest
                </button>
                <button
                  onClick={() => setSortBy('answered')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sortBy === 'answered'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✅ Answered
                </button>
              </div>

              {/* Search */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
                />
              </div>
            </div>

            {/* Questions List */}
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-800 mb-1">
                  {searchQuery ? 'No matching questions found' : 'No questions yet'}
                </h3>
                <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                  {searchQuery
                    ? 'Try clearing your search term or exploring other tabs.'
                    : 'Be the first to break the ice and ask the speaker a question!'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setIsAskModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 hover:bg-brand-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ask First Question</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    onUpvote={handleUpvote}
                    onRemoveUpvote={handleRemoveUpvote}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* POLLS VIEW */}
        {activeTab === 'polls' && (
          <div className="space-y-4">
            {polls.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center">
                <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-800 mb-1">No polls opened yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When the host launches an interactive poll, it will appear here in real time with animated live voting.
                </p>
              </div>
            ) : (
              polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  onVote={handleVotePoll}
                />
              ))
            )}
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Action Bar */}
      {activeTab === 'questions' && (
        <div className="sm:hidden fixed bottom-4 inset-x-4 z-30">
          <button
            onClick={() => setIsAskModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-brand-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-brand-600/30 active:scale-98 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Ask a Question</span>
          </button>
        </div>
      )}

      {/* Modals */}
      <AskQuestionModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
        onSubmit={handleAskQuestion}
        allowAnonymous={session?.allow_anonymous === 1}
        displayName={displayName}
      />

      {session && (
        <QRCodeModal
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          sessionCode={session.code}
          sessionTitle={session.title}
        />
      )}
    </div>
  );
};

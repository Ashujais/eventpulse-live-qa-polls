import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  MessageSquare, BarChart3, Plus, Download, MonitorPlay, QrCode,
  Users, CheckCircle, EyeOff, Pin, Trash2, Radio, Play, Pause, ExternalLink
} from 'lucide-react';
import { api } from '../lib/api.js';
import { getSocket, joinSessionRoom } from '../lib/socket.js';
import { useAuth } from '../context/AuthContext.js';
import { Session, Question, Poll } from '../types/index.js';
import { Navbar } from '../components/Navbar.js';
import { QuestionCard } from '../components/QuestionCard.js';
import { PollCard } from '../components/PollCard.js';
import { CreatePollModal } from '../components/CreatePollModal.js';
import { QRCodeModal } from '../components/QRCodeModal.js';
import { ToastContainer, ToastMessage } from '../components/Toast.js';

export const HostSessionManagePage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { hostUser, loading: authLoading } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'questions' | 'polls'>('questions');
  const [questionFilter, setQuestionFilter] = useState<'all' | 'unanswered' | 'answered' | 'hidden'>('all');

  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const addToast = (type: 'error' | 'success' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    if (!authLoading && !hostUser) {
      navigate('/host/login');
      return;
    }

    if (code && hostUser) {
      loadData();
    }
  }, [code, hostUser, authLoading]);

  const loadData = async () => {
    if (!code) return;
    const upperCode = code.toUpperCase();
    try {
      setLoading(true);
      const sessRes = await api.getSession(upperCode);
      setSession(sessRes.session);

      const qRes = await api.getQuestions(upperCode, undefined, true);
      setQuestions(qRes.questions);

      const pRes = await api.getPolls(upperCode);
      setPolls(pRes.polls);

      joinSessionRoom(upperCode, 'host-dashboard', hostUser?.name || 'Host');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  // Socket.IO event listeners
  useEffect(() => {
    if (!code) return;
    const socket = getSocket();

    const handleCount = (data: { count: number }) => setParticipantCount(data.count);

    const handleQCreated = (newQ: Question) => {
      setQuestions((prev) => {
        if (prev.some((q) => q.id === newQ.id)) return prev;
        return [newQ, ...prev];
      });
      addToast('info', `New question from ${newQ.author_name}`);
    };

    const handleQUpvoted = (data: { questionId: string; upvotesCount: number }) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === data.questionId ? { ...q, upvotes_count: data.upvotesCount } : q))
      );
    };

    const handleQUpdated = (updatedQ: Question) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === updatedQ.id ? { ...q, ...updatedQ } : q))
      );
    };

    const handleQDeleted = (data: { questionId: string }) => {
      setQuestions((prev) => prev.filter((q) => q.id !== data.questionId));
    };

    const handlePollCreated = (newPoll: Poll) => {
      setPolls((prev) => {
        if (prev.some((p) => p.id === newPoll.id)) return prev;
        return [newPoll, ...prev];
      });
    };

    const handlePollUpdated = (p: Poll) => {
      setPolls((prev) => prev.map((item) => (item.id === p.id ? { ...item, ...p } : item)));
    };

    const handlePollVoted = (data: { pollId: string; options: any[]; total_votes: number }) => {
      setPolls((prev) =>
        prev.map((p) => {
          if (p.id !== data.pollId) return p;
          return { ...p, total_votes: data.total_votes, options: data.options };
        })
      );
    };

    socket.on('session:participant_count', handleCount);
    socket.on('question:created', handleQCreated);
    socket.on('question:upvoted', handleQUpvoted);
    socket.on('question:updated', handleQUpdated);
    socket.on('question:deleted', handleQDeleted);
    socket.on('poll:created', handlePollCreated);
    socket.on('poll:activated', handlePollUpdated);
    socket.on('poll:updated', handlePollUpdated);
    socket.on('poll:voted', handlePollVoted);

    return () => {
      socket.off('session:participant_count', handleCount);
      socket.off('question:created', handleQCreated);
      socket.off('question:upvoted', handleQUpvoted);
      socket.off('question:updated', handleQUpdated);
      socket.off('question:deleted', handleQDeleted);
      socket.off('poll:created', handlePollCreated);
      socket.off('poll:activated', handlePollUpdated);
      socket.off('poll:updated', handlePollUpdated);
      socket.off('poll:voted', handlePollVoted);
    };
  }, [code]);

  // Question Moderation Handler
  const handleModerate = async (
    questionId: string,
    updates: { is_answered?: number; is_hidden?: number; is_pinned?: number }
  ) => {
    if (!code) return;
    try {
      const res = await api.moderateQuestion(code, questionId, updates);
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? res.question : q))
      );
      if (updates.is_answered !== undefined) {
        addToast('success', updates.is_answered ? 'Marked as answered' : 'Marked unanswered');
      }
      if (updates.is_pinned !== undefined) {
        addToast('success', updates.is_pinned ? 'Spotlighted on stage display' : 'Spotlight removed');
      }
      if (updates.is_hidden !== undefined) {
        addToast('info', updates.is_hidden ? 'Question hidden from audience' : 'Question restored to audience');
      }
    } catch (err: any) {
      addToast('error', err.message || 'Failed to moderate question');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!code) return;
    try {
      await api.deleteQuestion(code, questionId);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      addToast('success', 'Question deleted');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete question');
    }
  };

  // Poll Handlers
  const handleCreatePoll = async (data: {
    question: string;
    options: string[];
    status: 'draft' | 'active';
    show_results: boolean;
  }) => {
    if (!code) return;
    try {
      const res = await api.createPoll(code, data);
      setPolls((prev) => [res.poll, ...prev]);
      addToast('success', 'Poll created successfully!');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to create poll');
      throw err;
    }
  };

  const handleUpdatePollStatus = async (
    pollId: string,
    updates: { status?: 'draft' | 'active' | 'closed'; show_results?: boolean }
  ) => {
    if (!code) return;
    try {
      const res = await api.updatePollStatus(code, pollId, updates);
      setPolls((prev) => prev.map((p) => (p.id === pollId ? res.poll : p)));
      addToast('success', 'Poll status updated');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to update poll');
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!code) return;
    try {
      await api.deletePoll(code, pollId);
      setPolls((prev) => prev.filter((p) => p.id !== pollId));
      addToast('success', 'Poll deleted');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete poll');
    }
  };

  // Toggle Session Active Status
  const handleToggleSessionStatus = async () => {
    if (!session) return;
    const newStatus = session.is_active === 1 ? false : true;
    try {
      const res = await api.updateSessionStatus(session.id, newStatus);
      setSession(res.session);
      addToast('success', newStatus ? 'Session opened for attendees' : 'Session concluded');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to change session status');
    }
  };

  // Download Export (CSV or JSON)
  const handleDownloadExport = (format: 'csv' | 'json') => {
    if (!code) return;
    const url = api.exportSessionUrl(code, format);
    window.open(url, '_blank');
    addToast('success', `Exporting report as ${format.toUpperCase()}...`);
  };

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    let list = [...questions];
    if (questionFilter === 'unanswered') {
      list = list.filter((q) => q.is_answered === 0 && q.is_hidden === 0);
    } else if (questionFilter === 'answered') {
      list = list.filter((q) => q.is_answered === 1);
    } else if (questionFilter === 'hidden') {
      list = list.filter((q) => q.is_hidden === 1);
    }
    list.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned;
      return b.upvotes_count - a.upvotes_count;
    });
    return list;
  }, [questions, questionFilter]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Connecting to session control room...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <Navbar
        sessionCode={session?.code}
        sessionTitle={session?.title}
        participantCount={participantCount}
        isHostView={true}
      />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6">
        {/* CONTROL ROOM TOP BANNER */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                  Host Control Room
                </span>
                <span className="text-slate-300">•</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    session?.is_active === 1
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {session?.is_active === 1 ? 'Live & Accepting Votes' : 'Session Concluded'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {session?.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                {session?.description || 'No description provided.'}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Presenter View */}
              <Link
                to={`/presenter/${session?.code}`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <MonitorPlay className="w-4 h-4 text-brand-400" />
                <span>Launch Presenter View</span>
              </Link>

              {/* QR Code */}
              <button
                onClick={() => setIsQRModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                title="Show Join QR Code"
              >
                <QrCode className="w-4 h-4 text-brand-600" />
                <span>Join QR</span>
              </button>

              {/* Export Dropdown / Buttons (Stretch requirement) */}
              <button
                onClick={() => handleDownloadExport('csv')}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-all shadow-xs"
                title="Download CSV report of questions & poll results"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => handleDownloadExport('json')}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                title="Export as JSON"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>JSON</span>
              </button>

              {/* End/Reopen Session */}
              <button
                onClick={handleToggleSessionStatus}
                className={`px-3 py-2.5 border rounded-xl text-xs font-bold transition-all ${
                  session?.is_active === 1
                    ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {session?.is_active === 1 ? 'End Event' : 'Re-open Event'}
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span className="text-xl font-black text-slate-900 font-mono">
                {participantCount}
              </span>
              <span className="text-[11px] font-bold text-slate-500 block">
                Live Attendees
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span className="text-xl font-black text-brand-600 font-mono">
                {questions.length}
              </span>
              <span className="text-[11px] font-bold text-slate-500 block">
                Total Questions
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span className="text-xl font-black text-emerald-600 font-mono">
                {questions.filter((q) => q.is_answered === 1).length}
              </span>
              <span className="text-[11px] font-bold text-slate-500 block">
                Answered
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span className="text-xl font-black text-indigo-600 font-mono">
                {polls.length}
              </span>
              <span className="text-[11px] font-bold text-slate-500 block">
                Interactive Polls
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('questions')}
              className={`flex items-center gap-2 pb-3 px-3 border-b-2 font-bold text-sm transition-all ${
                activeTab === 'questions'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Questions Moderation ({questions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('polls')}
              className={`flex items-center gap-2 pb-3 px-3 border-b-2 font-bold text-sm transition-all ${
                activeTab === 'polls'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Polls Management ({polls.length})</span>
            </button>
          </div>

          {activeTab === 'polls' && (
            <button
              onClick={() => setIsPollModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Poll</span>
            </button>
          )}
        </div>

        {/* QUESTIONS MODERATION TAB */}
        {activeTab === 'questions' && (
          <div>
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <button
                onClick={() => setQuestionFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  questionFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                All ({questions.length})
              </button>
              <button
                onClick={() => setQuestionFilter('unanswered')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  questionFilter === 'unanswered'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Unanswered ({questions.filter((q) => q.is_answered === 0 && q.is_hidden === 0).length})
              </button>
              <button
                onClick={() => setQuestionFilter('answered')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  questionFilter === 'answered'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Answered ({questions.filter((q) => q.is_answered === 1).length})
              </button>
              <button
                onClick={() => setQuestionFilter('hidden')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  questionFilter === 'hidden'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Hidden ({questions.filter((q) => q.is_hidden === 1).length})
              </button>
            </div>

            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-800 mb-1">
                  No questions in this filter
                </h3>
                <p className="text-xs text-slate-500">
                  When attendees submit questions, they will show up here for live moderation.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    isHost={true}
                    onModerate={handleModerate}
                    onDelete={handleDeleteQuestion}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* POLLS MANAGEMENT TAB */}
        {activeTab === 'polls' && (
          <div className="space-y-4">
            {polls.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center">
                <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-800 mb-1">No polls created yet</h3>
                <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                  Create a live single-choice poll to engage your audience during the presentation.
                </p>
                <button
                  onClick={() => setIsPollModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Poll</span>
                </button>
              </div>
            ) : (
              polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  isHost={true}
                  onUpdateStatus={handleUpdatePollStatus}
                  onDelete={handleDeletePoll}
                />
              ))
            )}
          </div>
        )}
      </main>

      {/* MODALS */}
      <CreatePollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        onSubmit={handleCreatePoll}
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

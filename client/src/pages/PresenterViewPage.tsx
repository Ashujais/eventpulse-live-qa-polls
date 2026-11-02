import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Radio, Users, ThumbsUp, BarChart3, MessageSquare, Maximize2, Minimize2,
  QrCode, ArrowRight, ArrowLeft, CheckCircle2, Pin, Sparkles, X
} from 'lucide-react';
import { api } from '../lib/api.js';
import { getSocket, joinSessionRoom } from '../lib/socket.js';
import { Session, Question, Poll } from '../types/index.js';

export const PresenterViewPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [stageMode, setStageMode] = useState<'questions' | 'poll'>('questions');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  const joinUrl = `${window.location.origin}/session/${code?.toUpperCase()}`;

  // Initial Fetch
  useEffect(() => {
    if (!code) return;
    const upperCode = code.toUpperCase();

    async function loadData() {
      try {
        setLoading(true);
        const sessRes = await api.getSession(upperCode);
        setSession(sessRes.session);

        const qRes = await api.getQuestions(upperCode, undefined, true);
        setQuestions(qRes.questions);

        const pRes = await api.getPolls(upperCode);
        setPolls(pRes.polls);

        joinSessionRoom(upperCode, 'presenter-screen', 'Stage Presenter');
      } catch (err) {
        console.error('Failed to load presenter data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [code]);

  // Real-time WebSocket Listeners
  useEffect(() => {
    if (!code) return;
    const socket = getSocket();

    const handleCount = (data: { count: number }) => setParticipantCount(data.count);

    const handleQCreated = (newQ: Question) => {
      setQuestions((prev) => [newQ, ...prev]);
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

    const handlePollCreated = (p: Poll) => {
      setPolls((prev) => [p, ...prev]);
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

  // Sorted Questions for Stage
  const stageQuestions = useMemo(() => {
    const list = questions.filter((q) => q.is_hidden === 0 && q.is_answered === 0);
    list.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned;
      return b.upvotes_count - a.upvotes_count;
    });
    return list;
  }, [questions]);

  const currentQuestion = stageQuestions[selectedQuestionIndex] || stageQuestions[0];

  // Active Poll
  const activePoll = useMemo(() => {
    return polls.find((p) => p.status === 'active') || polls[0];
  }, [polls]);

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setSelectedQuestionIndex((prev) => Math.min(prev + 1, stageQuestions.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setSelectedQuestionIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'p') {
        setStageMode((prev) => (prev === 'questions' ? 'poll' : 'questions'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stageQuestions.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <Radio className="w-12 h-12 text-brand-500 animate-pulse mb-4" />
        <h2 className="text-xl font-bold tracking-tight">Initializing Stage Presenter Display...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white overflow-hidden">
      {/* STAGE HEADER BAR */}
      <header className="px-6 lg:px-12 py-5 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-center justify-between gap-4">
        {/* Left: Event Name & Badge */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/30">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black tracking-tight text-white line-clamp-1">
              {session?.title || 'Live Keynote Event'}
            </h1>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <Users className="w-3.5 h-3.5" />
                <span>{participantCount} Connected Attendees</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center: Stage Mode Toggle */}
        <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-inner">
          <button
            onClick={() => setStageMode('questions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              stageMode === 'questions'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Top Questions ({stageQuestions.length})</span>
          </button>

          <button
            onClick={() => setStageMode('poll')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
              stageMode === 'poll'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Live Poll</span>
            {activePoll?.status === 'active' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>
        </div>

        {/* Right: Join Instructions & QR Pill */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setIsQrZoomed(true)}
            className="flex items-center gap-3 px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-700/80 rounded-2xl cursor-pointer group transition-all"
            title="Click to enlarge QR Code"
          >
            <div className="p-1 bg-white rounded-lg">
              <QRCodeSVG value={joinUrl} size={32} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Join with Code
              </div>
              <div className="font-mono text-base font-black text-brand-400 tracking-wider">
                {session?.code}
              </div>
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-2xl transition-colors"
            title="Toggle Fullscreen ('F')"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* STAGE MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-12 py-8 flex flex-col justify-center">
        {/* QUESTIONS STAGE */}
        {stageMode === 'questions' && (
          <div className="w-full">
            {!currentQuestion ? (
              <div className="text-center py-20">
                <MessageSquare className="w-16 h-16 text-slate-700 mx-auto mb-4 animate-bounce" />
                <h2 className="text-3xl font-extrabold text-white mb-2">No Active Questions Yet</h2>
                <p className="text-base text-slate-400 max-w-md mx-auto mb-6">
                  Audience members can join by scanning the QR code or visiting with code{' '}
                  <span className="font-mono text-brand-400 font-bold">{session?.code}</span>.
                </p>
                <button
                  onClick={() => setIsQrZoomed(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/25"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Show Join QR Code</span>
                </button>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in">
                {/* Spotlight Header Badges */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {currentQuestion.is_pinned === 1 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-500 text-white shadow-lg shadow-brand-500/30">
                        <Pin className="w-3.5 h-3.5 rotate-45" />
                        <span>Stage Spotlight Question</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>#1 Most Upvoted Question</span>
                      </span>
                    )}

                    <span className="text-xs text-slate-400 font-semibold">
                      Question {selectedQuestionIndex + 1} of {stageQuestions.length}
                    </span>
                  </div>

                  {/* Upvote Pill */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/30 rounded-2xl text-brand-400 font-mono">
                    <ThumbsUp className="w-5 h-5 fill-brand-400" />
                    <span className="text-2xl font-black">{currentQuestion.upvotes_count}</span>
                    <span className="text-xs font-sans text-brand-300 uppercase tracking-wider font-bold ml-1">
                      Votes
                    </span>
                  </div>
                </div>

                {/* GIANT SPOTLIGHT CARD */}
                <div className="relative p-8 sm:p-12 lg:p-16 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-950 border-2 border-brand-500/40 shadow-2xl shadow-brand-500/10">
                  <p className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight mb-8">
                    "{currentQuestion.content}"
                  </p>

                  <div className="flex items-center justify-between border-t border-slate-800 pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-brand-400 text-sm">
                        {currentQuestion.is_anonymous ? '?' : currentQuestion.author_name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-200">
                          {currentQuestion.is_anonymous ? 'Anonymous Attendee' : currentQuestion.author_name}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                          Submitted live from audience
                        </div>
                      </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedQuestionIndex((prev) => Math.max(0, prev - 1))}
                        disabled={selectedQuestionIndex === 0}
                        className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-white transition-all"
                        title="Previous Question (←)"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() =>
                          setSelectedQuestionIndex((prev) =>
                            Math.min(stageQuestions.length - 1, prev + 1)
                          )
                        }
                        disabled={selectedQuestionIndex >= stageQuestions.length - 1}
                        className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-white transition-all"
                        title="Next Question (→ / Space)"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Queue of Next Questions */}
                {stageQuestions.length > 1 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                      Up Next on Deck:
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {stageQuestions.slice(1, 4).map((nextQ, idx) => (
                        <div
                          key={nextQ.id}
                          onClick={() => setSelectedQuestionIndex(idx + 1)}
                          className="p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span className="font-semibold text-slate-300 truncate max-w-[150px]">
                              {nextQ.is_anonymous ? 'Anonymous' : nextQ.author_name}
                            </span>
                            <span className="font-mono font-bold text-brand-400 flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" />
                              {nextQ.upvotes_count}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-200 line-clamp-2">
                            {nextQ.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LIVE POLL STAGE */}
        {stageMode === 'poll' && (
          <div className="w-full max-w-4xl mx-auto">
            {!activePoll ? (
              <div className="text-center py-20">
                <BarChart3 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <h2 className="text-3xl font-extrabold text-white mb-2">No Poll Active</h2>
                <p className="text-base text-slate-400">
                  Launch a live poll from the Host Room to display interactive animated charts here.
                </p>
              </div>
            ) : (
              <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/90 border-2 border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Live Interactive Voting</span>
                  </span>

                  <span className="text-sm font-bold text-slate-400 font-mono">
                    {activePoll.total_votes || 0} Total Votes
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight mb-8">
                  {activePoll.question}
                </h2>

                {/* Giant Poll Options Bars */}
                <div className="space-y-4">
                  {activePoll.options?.map((opt, idx) => {
                    const percentage = opt.percentage || 0;
                    return (
                      <div
                        key={opt.id}
                        className="relative overflow-hidden p-5 rounded-2xl bg-slate-950 border border-slate-800/80"
                      >
                        {/* Live Animated Background Fill */}
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-600/40 via-indigo-600/30 to-brand-500/20 poll-bar-transition"
                          style={{ width: `${percentage}%` }}
                        />

                        <div className="relative flex items-center justify-between gap-4 z-10">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-slate-800/90 text-brand-400 font-black text-sm flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-lg sm:text-xl font-bold text-white">
                              {opt.text}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 font-mono">
                            <span className="text-xs text-slate-400">
                              {opt.votes_count} votes
                            </span>
                            <span className="text-2xl sm:text-3xl font-black text-white w-20 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* STAGE FOOTER BAR */}
      <footer className="px-6 lg:px-12 py-4 border-t border-slate-800/80 bg-slate-900/20 backdrop-blur-md flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-mono bg-slate-900 px-2 py-1 rounded-md text-slate-300">Space / →</span>
          <span>Next question</span>
          <span className="text-slate-600">•</span>
          <span className="font-mono bg-slate-900 px-2 py-1 rounded-md text-slate-300">P</span>
          <span>Toggle Poll/Questions</span>
          <span className="text-slate-600">•</span>
          <span className="font-mono bg-slate-900 px-2 py-1 rounded-md text-slate-300">F</span>
          <span>Fullscreen</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Powered by EventPulse</span>
          <Link
            to={`/session/${session?.code}`}
            className="text-brand-400 hover:text-brand-300 hover:underline"
          >
            Switch to Audience Mode →
          </Link>
        </div>
      </footer>

      {/* ZOOMED QR CODE MODAL FOR BACK ROW AUDIENCE */}
      {isQrZoomed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="relative bg-slate-900 rounded-3xl p-8 sm:p-12 border-2 border-brand-500/50 shadow-2xl text-center max-w-lg w-full">
            <button
              onClick={() => setIsQrZoomed(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-3xl font-black text-white mb-2">Scan with Phone</h2>
            <p className="text-sm text-slate-400 mb-8">
              Open your camera app to ask questions and vote live
            </p>

            <div className="p-6 bg-white rounded-3xl shadow-2xl inline-block mb-8">
              <QRCodeSVG value={joinUrl} size={300} level="H" includeMargin={true} />
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 uppercase tracking-widest block font-bold mb-1">
                Event Join Code
              </span>
              <span className="font-mono text-4xl font-black text-brand-400 tracking-widest">
                {session?.code}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

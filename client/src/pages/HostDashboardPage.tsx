import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus, Users, MessageSquare, BarChart3, MonitorPlay, ExternalLink,
  Shield, Check, X, Calendar, Settings, Sparkles
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Navbar } from '../components/Navbar.js';
import { Session } from '../types/index.js';

export const HostDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { hostUser, loading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<(Session & { questions_count: number; polls_count: number; participants_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Session Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !hostUser) {
      navigate('/host/login');
      return;
    }

    if (hostUser) {
      loadSessions();
    }
  }, [hostUser, authLoading]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await api.getHostSessions();
      setSessions(res.sessions);
    } catch (err) {
      console.error('Failed to load host sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await api.createSession({
        title: title.trim(),
        description: description.trim(),
        customCode: customCode.trim() || undefined,
        allow_anonymous: allowAnonymous
      });

      setIsCreateModalOpen(false);
      setTitle('');
      setDescription('');
      setCustomCode('');
      navigate(`/host/session/${res.session.code}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading your organizer dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar isHostView={true} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                Organizer Dashboard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome, {hostUser?.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Manage your live Q&A sessions, create polls, and control presenter views.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-brand-500/25 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Session</span>
          </button>
        </div>

        {/* Sessions Grid */}
        {sessions.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-200/90 text-center shadow-xs">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800 mb-1">No sessions yet</h3>
            <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
              Create your first live interactive event session to start accepting questions and running polls.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create Session</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest px-2.5 py-1 bg-brand-50 border border-brand-200 text-brand-700 rounded-lg">
                      {sess.code}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        sess.is_active === 1
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {sess.is_active === 1 ? 'Live & Active' : 'Ended'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1 mb-1.5">
                    {sess.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 mb-4 min-h-[2rem]">
                    {sess.description || 'No description provided.'}
                  </p>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-2 py-3 px-3 bg-slate-50 rounded-2xl border border-slate-100 mb-5 text-center">
                    <div>
                      <div className="text-sm font-black text-slate-800 font-mono">
                        {sess.questions_count}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Questions
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-800 font-mono">
                        {sess.polls_count}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Polls
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-800 font-mono">
                        {sess.participants_count}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Audience
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Link
                    to={`/host/session/${sess.code}`}
                    className="flex-1 text-center py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Control Room
                  </Link>

                  <Link
                    to={`/presenter/${sess.code}`}
                    target="_blank"
                    className="p-2 text-slate-600 hover:text-brand-600 hover:bg-brand-50 border border-slate-200 rounded-xl transition-colors"
                    title="Open Presenter View"
                  >
                    <MonitorPlay className="w-4 h-4" />
                  </Link>

                  <Link
                    to={`/session/${sess.code}`}
                    target="_blank"
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                    title="Preview Audience Screen"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CREATE SESSION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-slate-900 mb-1">Create Event Session</h3>
            <p className="text-xs text-slate-500 mb-6">
              Set up your event title, description, and join code.
            </p>

            {error && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Session Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AI & Future of Software Keynote 2026"
                  maxLength={100}
                  autoFocus
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 rounded-xl text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Description / Welcome Message (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Welcome everyone! Submit your burning questions and upvote others."
                  rows={2}
                  maxLength={500}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 rounded-xl text-sm outline-none transition-all resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Custom Join Code (Optional)
                  </label>
                  <span className="text-[11px] text-slate-400">Leave blank for auto-generated</span>
                </div>
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. TECH26"
                  maxLength={10}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 rounded-xl text-sm font-mono font-bold tracking-wider uppercase outline-none transition-all"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowAnonymous}
                    onChange={(e) => setAllowAnonymous(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                  />
                  <span>Allow audience to post questions anonymously</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || title.trim().length < 3}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/25 active:scale-95"
                >
                  {submitting ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

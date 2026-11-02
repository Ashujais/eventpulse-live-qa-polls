import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Radio, ArrowRight, Sparkles, MessageSquare, BarChart3, Tv, Users, Shield, CheckCircle } from 'lucide-react';
import { api } from '../lib/api.js';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter a session code');
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter your display name');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const cleanCode = code.toUpperCase().trim();

      // Check session and register participant
      const existingParticipantId = localStorage.getItem('eventpulse_participant_id') || undefined;
      const res = await api.joinSession(cleanCode, displayName.trim(), existingParticipantId);

      // Save participant credentials in localStorage
      localStorage.setItem('eventpulse_participant_id', res.participant.id);
      localStorage.setItem('eventpulse_display_name', res.participant.display_name);

      navigate(`/session/${cleanCode}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join session. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setCode('DEMO26');
    setDisplayName('Guest Attendee');
    try {
      setLoading(true);
      setError(null);
      const res = await api.joinSession('DEMO26', 'Guest Attendee');
      localStorage.setItem('eventpulse_participant_id', res.participant.id);
      localStorage.setItem('eventpulse_display_name', res.participant.display_name);
      navigate('/session/DEMO26');
    } catch (err: any) {
      setError(err.message || 'Demo session not initialized. Please run seed script.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/20 to-white flex flex-col">
      {/* Top Navbar */}
      <nav className="w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-brand-700 bg-clip-text text-transparent">
            EventPulse
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/host/login"
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-brand-600 hover:bg-slate-100/80 rounded-xl transition-all"
          >
            Host Portal
          </Link>
          <button
            onClick={handleQuickDemo}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 rounded-xl transition-all shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Try DEMO26</span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-20 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        {/* Left Column / Pitch */}
        <div className="flex-1 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold uppercase tracking-wider mb-6">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping" />
            <span>Real-Time Live Event Engagement</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
            Interactive Q&A & polls for{' '}
            <span className="bg-gradient-to-r from-brand-600 via-indigo-600 to-indigo-800 bg-clip-text text-transparent">
              live audiences.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
            Attendees join with a short code in seconds—no app install, no account required.
            Ask and upvote questions, vote in live polls, and stream results directly to the big screen.
          </p>

          {/* Quick Value Props */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto lg:mx-0 pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Strict 1-vote server limits</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Zero-refresh WebSockets</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Big-screen presenter view</span>
            </div>
          </div>
        </div>

        {/* Right Column / Join Card */}
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl p-7 sm:p-9 shadow-2xl shadow-indigo-500/10 border border-slate-200/90 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-bl-full pointer-events-none" />

            <div className="mb-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
                Join an Event
              </h2>
              <p className="text-xs text-slate-500">
                Enter your event's 6-character code to join the conversation.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Event Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      if (error) setError(null);
                    }}
                    placeholder="e.g. DEMO26"
                    maxLength={10}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 rounded-xl text-base font-mono font-bold tracking-widest text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal outline-none transition-all uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Sarah Jenkins"
                  maxLength={50}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 rounded-xl text-sm font-medium text-slate-900 outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-500/25 active:scale-98 cursor-pointer mt-2"
              >
                <span>{loading ? 'Joining...' : 'Enter Session'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Hosting an event?</span>
              <Link
                to="/host/login"
                className="font-bold text-brand-600 hover:text-brand-700 hover:underline"
              >
                Host Login →
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Feature Pillars */}
      <section className="border-t border-slate-200/80 bg-white/50 py-12 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Frictionless Joining</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              No account creation, passwords, or app downloads. Just type the 6-character code and participate.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Live Ranked Q&A</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Real-time upvoting algorithm bubbles top community questions to the surface instantly.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Interactive Polls</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Single-choice live polls with animated bar charts updating instantly as audience members vote.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <Tv className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Big-Screen Presenter</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Dedicated projector view for stage displays with oversized typography and instant scannable QR code.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

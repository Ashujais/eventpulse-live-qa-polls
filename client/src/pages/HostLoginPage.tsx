import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Radio, Shield, Sparkles, ArrowRight, Lock, Mail, User } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

export const HostLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register({ email, name, password });
        login(res.token, res.host);
      } else {
        const res = await api.login({ email, password });
        login(res.token, res.host);
      }
      navigate('/host');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({
        email: 'host@eventpulse.io',
        password: 'password123'
      });
      login(res.token, res.host);
      navigate('/host');
    } catch (err: any) {
      setError('Demo host login failed. Make sure you ran `npm run seed`.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-slate-900 to-brand-700 bg-clip-text text-transparent">
            EventPulse
          </span>
        </Link>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          {isRegister ? 'Create Host Account' : 'Host Control Center'}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Create events, manage live Q&A, launch interactive polls, and export reports.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-200/80">
          {/* Quick Demo One-Click Login Button */}
          <div className="mb-6">
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-brand-50 to-indigo-50 border border-brand-200 hover:border-brand-300 text-brand-700 rounded-2xl text-xs font-bold transition-all shadow-xs hover:shadow-sm active:scale-98"
            >
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>1-Click Demo Host Login</span>
            </button>
            <div className="mt-2 text-center text-[11px] text-slate-400">
              Pre-filled: <code className="text-slate-600 font-mono">host@eventpulse.io</code> / <code className="text-slate-600 font-mono">password123</code>
            </div>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-bold tracking-wider">
                Or continue with password
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="host@eventpulse.io"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-brand-500/25 active:scale-98 cursor-pointer mt-2"
            >
              <span>{loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            {isRegister ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegister(false)}
                  className="font-bold text-brand-600 hover:underline"
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Need an organizer account?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegister(true)}
                  className="font-bold text-brand-600 hover:underline"
                >
                  Register here
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

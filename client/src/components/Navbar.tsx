import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio, Users, MonitorPlay, LogOut, Copy, Check, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface NavbarProps {
  sessionCode?: string;
  sessionTitle?: string;
  participantCount?: number;
  isHostView?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  sessionCode,
  sessionTitle,
  participantCount,
  isHostView = false
}) => {
  const { hostUser, logout } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);

  const copyCode = () => {
    if (sessionCode) {
      navigator.clipboard.writeText(sessionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-brand-700 bg-clip-text text-transparent">
                EventPulse
              </span>
              <span className="hidden sm:inline-block ml-1.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-brand-50 text-brand-700 border border-brand-200 rounded-md">
                Live
              </span>
            </div>
          </Link>

          {/* Session Title (Desktop) */}
          {sessionTitle && (
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200">
              <span className="text-sm font-semibold text-slate-800 truncate max-w-xs lg:max-w-md">
                {sessionTitle}
              </span>
            </div>
          )}
        </div>

        {/* Center / Session Code Badge */}
        {sessionCode && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              title="Click to copy join code"
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl transition-all cursor-pointer group active:scale-95"
            >
              <span className="text-xs uppercase font-medium text-slate-500 tracking-wider">Code:</span>
              <span className="font-mono font-bold text-sm text-brand-600 tracking-wider">
                {sessionCode}
              </span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
              )}
            </button>

            {participantCount !== undefined && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <Users className="w-3.5 h-3.5" />
                <span>{participantCount} live</span>
              </div>
            )}
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {sessionCode && (
            <Link
              to={`/presenter/${sessionCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-brand-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm active:scale-95"
              title="Open Presenter Big-Screen View"
            >
              <MonitorPlay className="w-4 h-4 text-brand-600" />
              <span>Presenter View</span>
            </Link>
          )}

          {hostUser ? (
            <div className="flex items-center gap-2">
              <Link
                to="/host"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  isHostView
                    ? 'bg-brand-50 text-brand-700 border border-brand-200'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-4 h-4 text-brand-600" />
                <span className="hidden sm:inline">Host Room</span>
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/host/login"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline px-2 py-1"
            >
              Host Portal
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

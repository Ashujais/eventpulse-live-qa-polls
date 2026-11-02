import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone, Copy, Check } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCode: string;
  sessionTitle: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  sessionCode,
  sessionTitle
}) => {
  const [copied, setCopied] = React.useState(false);
  if (!isOpen) return null;

  const joinUrl = `${window.location.origin}/session/${sessionCode}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 mx-auto mb-3 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center">
          <Smartphone className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-bold text-slate-900 mb-1">Scan to Join</h3>
        <p className="text-xs text-slate-500 mb-6 truncate max-w-xs mx-auto">
          {sessionTitle}
        </p>

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl shadow-inner border-2 border-dashed border-slate-200 inline-block mb-4">
          <QRCodeSVG
            value={joinUrl}
            size={220}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-4">
          <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold mb-0.5">
            Join Code
          </span>
          <span className="font-mono text-2xl font-black text-brand-600 tracking-widest">
            {sessionCode}
          </span>
        </div>

        <button
          onClick={copyUrl}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all active:scale-95"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Direct Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { X, Send, UserCheck, ShieldCheck } from 'lucide-react';

interface AskQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string, isAnonymous: boolean) => Promise<void>;
  allowAnonymous: boolean;
  displayName: string;
}

export const AskQuestionModal: React.FC<AskQuestionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  allowAnonymous,
  displayName
}) => {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length < 3) {
      setError('Question must be at least 3 characters long');
      return;
    }
    if (content.length > 500) {
      setError('Question cannot exceed 500 characters');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(content.trim(), isAnonymous);

      // Trigger celebratory confetti
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });

      setContent('');
      setIsAnonymous(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-slate-900 mb-1">Ask the Speaker</h3>
        <p className="text-xs text-slate-500 mb-5">
          Your question will be visible to everyone in the session and open for upvotes.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (error) setError(null);
              }}
              placeholder="What would you like to ask or discuss? Be specific and concise..."
              rows={4}
              maxLength={500}
              autoFocus
              className="w-full px-4 py-3 text-slate-900 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 rounded-2xl text-sm outline-none transition-all resize-none"
            />
            <div className="flex justify-between items-center mt-1 px-1 text-[11px] text-slate-400 font-medium">
              <span>Min 3 chars</span>
              <span className={content.length > 450 ? 'text-amber-500 font-bold' : ''}>
                {content.length}/500
              </span>
            </div>
          </div>

          {/* Anonymous toggle (Stretch feature) */}
          {allowAnonymous && (
            <div
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer select-none transition-all ${
                isAnonymous
                  ? 'bg-brand-50/70 border-brand-300 text-brand-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isAnonymous ? (
                  <ShieldCheck className="w-5 h-5 text-brand-600" />
                ) : (
                  <UserCheck className="w-5 h-5 text-slate-400" />
                )}
                <div>
                  <div className="text-xs font-bold">
                    {isAnonymous ? 'Asking Anonymously' : `Post as ${displayName}`}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {isAnonymous
                      ? 'Your name and profile will be hidden from everyone'
                      : 'Your display name will appear beside your question'}
                  </div>
                </div>
              </div>

              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={() => {}} // controlled by parent div click
                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer pointer-events-none"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || content.trim().length < 3}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/25 active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Posting...' : 'Post Question'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

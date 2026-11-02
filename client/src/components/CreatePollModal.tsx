import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2 } from 'lucide-react';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { question: string; options: string[]; status: 'draft' | 'active'; show_results: boolean }) => Promise<void>;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [status, setStatus] = useState<'draft' | 'active'>('active');
  const [showResults, setShowResults] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
    if (error) setError(null);
  };

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim().length < 3) {
      setError('Poll question must be at least 3 characters long');
      return;
    }

    const filteredOptions = options.map(o => o.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      setError('Please provide at least 2 non-empty options for the poll');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        question: question.trim(),
        options: filteredOptions,
        status,
        show_results: showResults
      });
      setQuestion('');
      setOptions(['', '']);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <BarChart2 className="w-4 h-4" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Create Live Poll</h3>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Audience can vote live from their devices (strictly 1 vote per attendee).
        </p>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Poll Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Which feature should we prioritize next?"
              maxLength={300}
              autoFocus
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 rounded-xl text-sm outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Choices (Single Choice)
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {options.length}/10 choices
              </span>
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs font-bold text-slate-400">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    maxLength={150}
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 rounded-xl text-sm outline-none transition-all"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove option"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 10 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 border border-brand-200 rounded-xl transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Choice</span>
              </button>
            )}
          </div>

          {/* Options Toggles */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={status === 'active'}
                onChange={(e) => setStatus(e.target.checked ? 'active' : 'draft')}
                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
              />
              <span>Launch & activate immediately (attendees will see it right away)</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showResults}
                onChange={(e) => setShowResults(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
              />
              <span>Show live bar chart results to audience after voting</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || question.trim().length < 3}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/25 active:scale-95"
            >
              {isSubmitting ? 'Creating...' : status === 'active' ? 'Launch Poll' : 'Save as Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

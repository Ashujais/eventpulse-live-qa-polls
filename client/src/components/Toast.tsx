import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border text-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          <span className="shrink-0 mt-0.5">
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-600" />}
          </span>
          <p className="flex-1 font-medium leading-relaxed">{toast.message}</p>
          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4 opacity-60 hover:opacity-100" />
          </button>
        </div>
      ))}
    </div>
  );
};

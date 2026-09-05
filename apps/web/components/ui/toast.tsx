'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantClass: Record<ToastVariant, string> = {
  success:
    'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100 shadow-[0_12px_40px_rgba(16,185,129,0.12)]',
  error:
    'border-rose-300/20 bg-rose-300/[0.08] text-rose-100 shadow-[0_12px_40px_rgba(244,63,94,0.12)]',
  info:
    'border-sky-300/20 bg-sky-300/[0.08] text-sky-100 shadow-[0_12px_40px_rgba(14,165,233,0.12)]',
};

const variantIconClass: Record<ToastVariant, string> = {
  success: 'text-emerald-300',
  error: 'text-rose-300',
  info: 'text-sky-300',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now() + Math.random();
    setItems(current => [...current, { id, message, variant }].slice(-3));
    window.setTimeout(() => {
      setItems(current => current.filter(item => item.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+12px)] sm:justify-end sm:px-6">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {items.map(item => (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm backdrop-blur-xl ${variantClass[item.variant]}`}
            >
              {item.variant === 'success' ? (
                <CheckCircle2 className={`mt-0.5 size-5 shrink-0 ${variantIconClass[item.variant]}`} />
              ) : item.variant === 'error' ? (
                <XCircle className={`mt-0.5 size-5 shrink-0 ${variantIconClass[item.variant]}`} />
              ) : (
                <Info className={`mt-0.5 size-5 shrink-0 ${variantIconClass[item.variant]}`} />
              )}
              <span className="min-w-0 flex-1 break-words text-current">{item.message}</span>
              <button
                type="button"
                className="shrink-0 rounded-full p-1 text-current/70 transition hover:bg-white/10 hover:text-current"
                aria-label="Dismiss notification"
                onClick={() => setItems(current => current.filter(value => value.id !== item.id))}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context.toast;
}

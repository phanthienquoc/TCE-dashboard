'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = { toast: (message: string, variant?: ToastVariant) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now() + Math.random();
    setItems(current => [...current, { id, message, variant }].slice(-3));
    window.setTimeout(() => setItems(current => current.filter(item => item.id !== id)), 3500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+12px)] sm:justify-end sm:px-6">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {items.map(item => (
            <div key={item.id} role="status" className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground shadow-lg">
              {item.variant === 'success' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : item.variant === 'error' ? <XCircle className="mt-0.5 size-5 shrink-0 text-danger" /> : <Info className="mt-0.5 size-5 shrink-0 text-primary" />}
              <span className="min-w-0 flex-1 break-words">{item.message}</span>
              <button type="button" className="shrink-0 rounded-full p-1 text-muted hover:bg-surface" aria-label="Dismiss notification" onClick={() => setItems(current => current.filter(value => value.id !== item.id))}><X className="size-4" /></button>
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

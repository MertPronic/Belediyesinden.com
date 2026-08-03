'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from './cn';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 shrink-0 text-red-500" />,
  info: <Info className="h-5 w-5 shrink-0 text-blue-500" />,
};

const STYLES: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50',
  error: 'border-red-200 bg-red-50',
  info: 'border-blue-200 bg-blue-50',
};

let idCounter = 0;
const OMUR_MS = 4500;

/** Tek bir toast kartı — mount'ta fade+slide ile içeri girer (bağımlılıksız geçiş). */
function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [görünür, setGörünür] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGörünür(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border p-3.5 shadow-lg transition-all duration-200',
        görünür ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
        STYLES[toast.variant],
      )}
    >
      {ICONS[toast.variant]}
      <p className="flex-1 pt-0.5 text-sm font-medium text-gray-800">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        className="text-gray-400 transition-colors hover:text-gray-600"
        aria-label="Kapat"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, variant, message }]);
      setTimeout(() => remove(id), OMUR_MS);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      info: (message: string) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** `<ToastProvider>` içinde kullanılır: `const toast = useToast(); toast.success('Kaydedildi.')`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast, ToastProvider içinde kullanılmalı');
  return ctx;
}

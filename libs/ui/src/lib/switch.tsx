'use client';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  wrapperClassName?: string;
}

/** Toggle switch — native checkbox tabanlı (SSR/uncontrolled form'larda da çalışır), sadece görsel özel. */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, className, wrapperClassName, ...props }, ref) => (
    <label className={cn('inline-flex cursor-pointer select-none items-center gap-2 text-sm text-gray-600', wrapperClassName)}>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          ref={ref}
          type="checkbox"
          className={cn('peer absolute inset-0 h-full w-full cursor-pointer opacity-0', className)}
          {...props}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-[var(--renk,#2563eb)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--renk,#2563eb)]/30 peer-focus-visible:ring-offset-2"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
        />
      </span>
      {label}
    </label>
  ),
);
Switch.displayName = 'Switch';

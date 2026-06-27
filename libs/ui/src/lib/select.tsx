'use client';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/** Native select (erişilebilir + SSR güvenli) — chevron ikonu overlay. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 py-2 text-sm text-gray-900 shadow-xs transition-colors',
          'focus-visible:outline-none focus-visible:ring-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid
            ? 'border-red-400 focus-visible:border-red-400 focus-visible:ring-red-200'
            : 'border-gray-300 focus-visible:border-[var(--renk,#2563eb)] focus-visible:ring-[color-mix(in_srgb,var(--renk,#2563eb)_25%,transparent)]',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  ),
);
Select.displayName = 'Select';

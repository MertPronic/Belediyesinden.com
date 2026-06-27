'use client';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Hata durumu — kırmızı ring. */
  invalid?: boolean;
  /** Sol ikon slot'u (lucide). */
  icon?: ReactNode;
}

/** Standart metin inputu — focus'ta tenant rengi ring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, icon, ...props }, ref) => {
    const base = cn(
      'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 shadow-xs transition-colors',
      'placeholder:text-gray-400',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
      'disabled:cursor-not-allowed disabled:opacity-50',
      invalid
        ? 'border-red-400 focus-visible:border-red-400 focus-visible:ring-red-200'
        : 'border-gray-300 focus-visible:border-[var(--renk,#2563eb)] focus-visible:ring-[color-mix(in_srgb,var(--renk,#2563eb)_25%,transparent)]',
      icon && 'pl-9',
      className,
    );

    if (icon) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
          <input ref={ref} className={base} {...props} />
        </div>
      );
    }
    return <input ref={ref} className={base} {...props} />;
  },
);
Input.displayName = 'Input';

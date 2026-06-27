'use client';
import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 shadow-xs transition-colors',
        'placeholder:text-gray-400',
        'focus-visible:outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid
          ? 'border-red-400 focus-visible:border-red-400 focus-visible:ring-red-200'
          : 'border-gray-300 focus-visible:border-[var(--renk,#2563eb)] focus-visible:ring-[color-mix(in_srgb,var(--renk,#2563eb)_25%,transparent)]',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

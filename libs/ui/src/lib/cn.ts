import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind class merge utility (shadcn/ui pattern). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

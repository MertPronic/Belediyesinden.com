import { type HTMLAttributes } from 'react';
import { cn } from './cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

/** İlan durum badge — renk durum'a göre. */
export function DurumBadge({ durum }: { durum: string }) {
  const map: Record<string, BadgeVariant> = {
    TASLAK: 'default',
    YAYINDA: 'success',
    CANLI_ARTIRMA: 'info',
    SONUCLANDI: 'warning',
    IPTAL: 'danger',
  };
  return <Badge variant={map[durum] ?? 'default'}>{durum}</Badge>;
}

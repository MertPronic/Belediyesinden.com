import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';
type BadgeSize = 'sm' | 'md';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-0.5 text-xs gap-1',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Önde küçük renkli nokta. */
  dot?: boolean;
  /** Opsiyonel ikon (dot yerine). */
  icon?: ReactNode;
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  dot,
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon && <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
      {children}
    </span>
  );
}

const durumVariant: Record<string, BadgeVariant> = {
  TASLAK: 'default',
  /** İlan kalemi (varlık) henüz ihaleye açılmadı — bkz. DECISIONS.md KK-25. */
  BEKLIYOR: 'default',
  YAYINDA: 'success',
  CANLI_ARTIRMA: 'info',
  SONUCLANDI: 'warning',
  IPTAL: 'danger',
};

const durumLabel: Record<string, string> = {
  TASLAK: 'Taslak',
  BEKLIYOR: 'Bekliyor',
  YAYINDA: 'Yayında',
  CANLI_ARTIRMA: 'Canlı Artırma',
  SONUCLANDI: 'Sonuçlandı',
  IPTAL: 'İptal',
};

/** İlan durum badge — renk duruma göre, okunabilir Türkçe etiket. */
export function DurumBadge({ durum, dot = true }: { durum: string; dot?: boolean }) {
  return (
    <Badge variant={durumVariant[durum] ?? 'default'} dot={dot}>
      {durumLabel[durum] ?? durum}
    </Badge>
  );
}

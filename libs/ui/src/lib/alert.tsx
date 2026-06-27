import { type HTMLAttributes, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react';
import { cn } from './cn';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const variantStyles: Record<AlertVariant, { box: string; icon: string }> = {
  info: { box: 'border-blue-200 bg-blue-50', icon: 'text-blue-600' },
  success: { box: 'border-green-200 bg-green-50', icon: 'text-green-600' },
  warning: { box: 'border-amber-200 bg-amber-50', icon: 'text-amber-600' },
  error: { box: 'border-red-200 bg-red-50', icon: 'text-red-600' },
};

const defaultIcons: Record<AlertVariant, ReactNode> = {
  info: <Info />,
  success: <CheckCircle2 />,
  warning: <TriangleAlert />,
  error: <XCircle />,
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  /** Özelleştirilmiş ikon (verilmezse variant'a göre default). */
  icon?: ReactNode | false;
  title?: string;
}

/** Çağrı kutusu (callout) — geri bildirim & durum mesajları. */
export function Alert({
  className,
  variant = 'info',
  icon,
  title,
  children,
  ...props
}: AlertProps) {
  const s = variantStyles[variant];
  const iconNode = icon === false ? null : icon ?? defaultIcons[variant];
  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-lg border p-4', s.box, className)}
      {...props}
    >
      {iconNode && (
        <span className={cn('mt-0.5 shrink-0 [&>svg]:h-5 [&>svg]:w-5', s.icon)}>{iconNode}</span>
      )}
      <div className="flex-1 space-y-0.5">
        {title && <p className="text-sm font-semibold text-gray-900">{title}</p>}
        {children && <div className="text-sm text-gray-600">{children}</div>}
      </div>
    </div>
  );
}

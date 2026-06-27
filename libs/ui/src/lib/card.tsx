import { type HTMLAttributes } from 'react';
import { cn } from './cn';

type CardVariant = 'default' | 'outline' | 'elevated';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Hover'da subtle lift (ilan kartları için). */
  interactive?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'border border-gray-200 bg-white shadow-sm',
  outline: 'border border-gray-200 bg-white',
  elevated: 'border border-gray-100 bg-white shadow-md',
};

export function Card({ className, variant = 'default', interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl',
        variantStyles[variant],
        interactive && 'transition-all hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold leading-tight text-gray-900', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-gray-500', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-3', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center border-t border-gray-100 p-6 pt-4', className)} {...props} />;
}

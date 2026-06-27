import { type HTMLAttributes } from 'react';
import { cn } from './cn';

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

/** İnce ayraç çizgisi. */
export function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  return (
    <div
      role="separator"
      className={cn(
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px self-stretch',
        'bg-gray-200',
        className,
      )}
      {...props}
    />
  );
}

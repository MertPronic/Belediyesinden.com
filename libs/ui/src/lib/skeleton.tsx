import { type HTMLAttributes } from 'react';
import { cn } from './cn';

/** Yükleme iskeleti — `animate-pulse` ile yer tutucu. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200', className)} {...props} />;
}

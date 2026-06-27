import { type LabelHTMLAttributes } from 'react';
import { cn } from './cn';

/** Form etiketi — `text-sm font-medium text-gray-700`. */
export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-sm font-medium leading-none text-gray-700', className)}
      {...props}
    />
  );
}

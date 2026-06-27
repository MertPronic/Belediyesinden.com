import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

/** Form grubu — etiket + alan + ipucu/hata düzeni. */
export function Field({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 space-y-1.5', className)} {...props}>
      {children}
    </div>
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium leading-none text-gray-700">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-gray-500">{children}</p>;
}

export function FieldError({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-red-600">{children}</p>;
}

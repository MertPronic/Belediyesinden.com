'use client';
import { useState, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

/**
 * Sekmeli içerik — sahibinden tarzı (Detay / İlan Bilgileri / ...).
 * `items` server-rendered ReactNode içerik alabilir (children boundary).
 */
export function Tabs({ items, defaultValue }: { items: TabItem[]; defaultValue?: string }) {
  const [active, setActive] = useState(defaultValue ?? items[0]?.value);
  const current = items.find((i) => i.value === active) ?? items[0];

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {items.map((it) => {
          const isActive = it.value === active;
          return (
            <button
              key={it.value}
              type="button"
              onClick={() => setActive(it.value)}
              className={cn(
                'relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors',
                isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {it.label}
              {isActive && (
                <span
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                  style={{ background: 'var(--renk)' }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-4">{current?.content}</div>
    </div>
  );
}

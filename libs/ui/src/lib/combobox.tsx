'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from './cn';

export interface ComboboxProps {
  name: string;
  defaultValue?: string;
  /** Seçilebilir değerler — yazıldıkça baştan eşleşenlere filtrelenir. */
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  /** Geçerli bir seçenek seçildiğinde (veya temizlendiğinde '') çağrılır. */
  onValueChange?: (value: string) => void;
}

/**
 * Yazarak filtrelenebilen seçici — native `<select>`'in uzun listeler (81 il gibi)
 * için alternatifi. Form'a `name` ile gizli input üzerinden değer taşır, native form
 * submit ile uyumludur.
 */
export function Combobox({ name, defaultValue = '', options, placeholder, disabled, onValueChange }: ComboboxProps) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
    setQuery(defaultValue);
    if (hiddenInputRef.current) hiddenInputRef.current.value = defaultValue;
  }, [defaultValue]);

  useEffect(() => {
    function disariTiklama(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener('mousedown', disariTiklama);
    return () => document.removeEventListener('mousedown', disariTiklama);
  }, [value]);

  const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');
  const aranan = trLower(query.trim());
  const filtreli = aranan ? options.filter((o) => trLower(o).startsWith(aranan)) : options;

  function sec(secilen: string) {
    // Gizli input'un DOM değerini senkron olarak da yaz — çağıran onValueChange
    // içinde form.requestSubmit() çağırırsa React'in state güncellemesini henüz
    // DOM'a yansıtmamış olma riskine (batching) karşı submit edilecek değer garanti güncel olsun.
    if (hiddenInputRef.current) hiddenInputRef.current.value = secilen;
    setValue(secilen);
    setQuery(secilen);
    setOpen(false);
    onValueChange?.(secilen);
  }

  function temizle() {
    if (hiddenInputRef.current) hiddenInputRef.current.value = '';
    setValue('');
    setQuery('');
    setOpen(false);
    onValueChange?.('');
  }

  return (
    <div ref={rootRef} className="relative">
      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={value} />
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(h + 1, filtreli.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (open && filtreli[highlight]) sec(filtreli[highlight]);
            } else if (e.key === 'Escape') {
              setOpen(false);
              setQuery(value);
            }
          }}
          className={cn(
            'flex h-10 w-full rounded-lg border bg-white px-3 py-2 pr-9 text-sm text-gray-900 shadow-xs transition-colors',
            'placeholder:text-gray-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'border-gray-300 focus-visible:border-[var(--renk,#2563eb)] focus-visible:ring-[color-mix(in_srgb,var(--renk,#2563eb)_25%,transparent)]',
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={temizle}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Temizle"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        )}
      </div>
      {open && !disabled && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {filtreli.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Sonuç yok</li>
          ) : (
            filtreli.map((o, i) => (
              <li key={o}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => sec(o)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50',
                    i === highlight && 'bg-gray-50',
                    o === value && 'font-medium text-gray-900',
                  )}
                >
                  {o}
                  {o === value && <Check className="h-4 w-4" style={{ color: 'var(--renk)' }} />}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

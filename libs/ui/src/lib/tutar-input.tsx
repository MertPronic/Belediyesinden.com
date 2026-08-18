'use client';
import { forwardRef, type ChangeEvent } from 'react';
import { Input, type InputProps } from './input';

/** Kullanıcının o ana kadar yazdığı ham basamaklar (binlik ayraç YOK, ondalık ayraç ','). */
function hamBasamaklar(giris: string): string {
  const temiz = giris.replace(/[^0-9,]/g, '');
  const ilkVirgul = temiz.indexOf(',');
  if (ilkVirgul === -1) return temiz;
  const tamKisim = temiz.slice(0, ilkVirgul).replace(/,/g, '');
  const kurusKismi = temiz.slice(ilkVirgul + 1).replace(/,/g, '').slice(0, 2);
  return `${tamKisim},${kurusKismi}`;
}

/** Ham basamaklardan ekranda gösterilecek, binlik noktalı metni üretir (örn. "100000" → "100.000"). */
function gorunumOlustur(ham: string): string {
  if (!ham) return '';
  const [tamKisim, kurusKismi] = ham.split(',');
  const tamGorunum = tamKisim ? Number(tamKisim).toLocaleString('tr-TR') : '';
  return kurusKismi !== undefined ? `${tamGorunum},${kurusKismi}` : tamGorunum;
}

/** Ham basamakları API'ye/`Number()`'a verilecek noktalı ondalık metne çevirir (örn. "100000,5" → "100000.5"). */
function sayisalDegerOlustur(ham: string): string {
  return ham.replace(',', '.');
}

export interface TutarInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  /** Ham sayısal değer — nokta ondalık, binlik ayraçsız (örn. "100000" ya da "100000.5"). `Number()`'a doğrudan verilebilir. */
  value: string;
  /** Kullanıcı her değiştirdiğinde aynı formatta (nokta ondalık) yeni değeri döner. */
  onChange: (value: string) => void;
}

/**
 * Türkçe binlik ayraçlı tutar girişi (örn. yazarken "100.000" görünür).
 * Dışarıya/API'ye her zaman düz nokta-ondalık sayısal metin verir — `value`/`onChange`
 * sözleşmesi `Input`inkiyle aynı, sadece görünüm formatlanır (drop-in değişim).
 */
export const TutarInput = forwardRef<HTMLInputElement, TutarInputProps>(
  ({ value, onChange, ...props }, ref) => {
    const ham = value.replace('.', ',');

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
      const yeniHam = hamBasamaklar(e.target.value);
      onChange(sayisalDegerOlustur(yeniHam));
    }

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={gorunumOlustur(ham)}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
TutarInput.displayName = 'TutarInput';

/**
 * İlan görsel yardımcıları — client değil (server component'ten çağrılabilir).
 * Backend ilan görselleri bağlanana kadar yerel SVG placeholder üretir
 * (harici bağımlılık YOK — her zaman yüklenir, kırık görünmez).
 */

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/** Tekil SVG placeholder data URI (gradient + sıra no + etiket). */
function svgPlaceholder(n: number, hue: number): string {
  const h1 = (hue + n * 22) % 360;
  const h2 = (hue + n * 22 + 35) % 360;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='900' height='560'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
<stop offset='0' stop-color='hsl(${h1},62%,55%)'/>
<stop offset='1' stop-color='hsl(${h2},58%,38%)'/>
</linearGradient></defs>
<rect width='900' height='560' fill='url(#g)'/>
<g fill='rgba(255,255,255,0.12)'>
<rect x='130' y='150' width='180' height='300' rx='8'/>
<rect x='340' y='90' width='220' height='360' rx='8'/>
<rect x='590' y='200' width='180' height='250' rx='8'/>
</g>
<text x='450' y='300' font-family='system-ui,sans-serif' font-size='200' font-weight='800' fill='rgba(255,255,255,0.95)' text-anchor='middle'>${n + 1}</text>
<text x='450' y='375' font-family='system-ui,sans-serif' font-size='30' font-weight='600' fill='rgba(255,255,255,0.75)' text-anchor='middle'>İlan Görseli</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** İlan ID'sinden tutarlı placeholder görsel data URI'ları üretir (15'e kadar). */
export function dummyGorseller(seed: string, count = 15): string[] {
  const n = Math.max(1, Math.min(count, 15));
  const hue = hashHue(seed);
  return Array.from({ length: n }, (_, i) => svgPlaceholder(i, hue));
}

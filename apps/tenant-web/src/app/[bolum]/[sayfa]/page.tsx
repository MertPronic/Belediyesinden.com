import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { Card, CardContent } from '@belediyesinden/ui';
import { SAYFALAR } from '../../bolum-icerik';

export function generateStaticParams() {
  return Object.keys(SAYFALAR).map((key) => {
    const [bolum, sayfa] = key.split('/');
    return { bolum, sayfa };
  });
}

export default async function StatikSayfaPage({
  params,
}: {
  params: Promise<{ bolum: string; sayfa: string }>;
}) {
  const { bolum, sayfa } = await params;
  const sayfa_ = SAYFALAR[`${bolum}/${sayfa}`];
  if (!sayfa_) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-400">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-gray-700">
          <Home className="h-3.5 w-3.5" />
          Ana Sayfa
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-600">{sayfa_.bolum}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-gray-600">{sayfa_.breadcrumb}</span>
      </nav>

      <div className="space-y-2">
        <span
          className="inline-block rounded-full accent-soft-bg px-2.5 py-0.5 text-xs font-medium text-gray-700"
        >
          {sayfa_.bolum}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{sayfa_.baslik}</h1>
      </div>

      <Card>
        <CardContent className="space-y-4">
          {sayfa_.paragraflar.map((p, i) => (
            <p key={i} className="leading-relaxed text-gray-700">
              {p}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

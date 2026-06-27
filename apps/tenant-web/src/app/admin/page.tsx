'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Box,
  CheckCircle2,
  FileText,
  Gavel,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DurumBadge,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@belediyesinden/ui';

interface RaporOzet {
  ilanlar: Record<string, number>;
  teklifSayisi: number;
  basvurular: Record<string, number>;
  varliklar: Record<string, number>;
  katilimciSayisi: number;
  gelir: number;
}
interface Ilan {
  id: string;
  baslik: string;
  durum: string;
  baslangic_fiyati: string;
}

const ILAN_DURUM_LABEL: Record<string, string> = {
  TASLAK: 'Taslak',
  YAYINDA: 'Yayında',
  CANLI_ARTIRMA: 'Canlı Artırma',
  SONUCLANDI: 'Sonuçlandı',
  IPTAL: 'İptal',
};

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg accent-soft-bg">
          <Icon className="h-5 w-5" style={{ color: 'var(--renk)' }} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold leading-tight tracking-tight text-gray-900">
            {value}
            {suffix && <span className="ml-1 text-sm font-normal text-gray-400">{suffix}</span>}
          </p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--renk)' }} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [ozet, setOzet] = useState<RaporOzet | null>(null);
  const [ilanlar, setIlanlar] = useState<Ilan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<RaporOzet>('/rapor/ozet').catch(() => null),
      apiFetch<Ilan[]>('/ilan').catch(() => []),
    ]).then(([o, i]) => {
      setOzet(o);
      setIlanlar(i);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const ilanToplam = ozet ? Object.values(ozet.ilanlar).reduce((a, b) => a + b, 0) : 0;
  const yayinda = (ozet?.ilanlar['YAYINDA'] ?? 0) + (ozet?.ilanlar['CANLI_ARTIRMA'] ?? 0);
  const varlikToplam = ozet ? Object.values(ozet.varliklar).reduce((a, b) => a + b, 0) : 0;
  const maxDurum = ozet ? Math.max(1, ...Object.values(ozet.ilanlar)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Genel Bakış</h1>
        <p className="mt-1 text-sm text-gray-500">Belediye ihale performans özeti</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={FileText} label="Toplam İlan" value={ilanToplam} />
        <StatCard icon={TrendingUp} label="Yayında" value={yayinda} />
        <StatCard icon={Gavel} label="Teklif" value={ozet?.teklifSayisi ?? 0} />
        <StatCard icon={Users} label="Katılımcı" value={ozet?.katilimciSayisi ?? 0} />
        <StatCard icon={Wallet} label="Gelir" value={(ozet?.gelir ?? 0).toLocaleString('tr-TR')} suffix="₺" />
        <StatCard icon={Box} label="Varlık" value={varlikToplam} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">İlan Durum Dağılımı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ozet && Object.keys(ozet.ilanlar).length > 0 ? (
              Object.entries(ozet.ilanlar).map(([durum, n]) => (
                <BarRow key={durum} label={ILAN_DURUM_LABEL[durum] ?? durum} count={n} max={maxDurum} />
              ))
            ) : (
              <p className="text-sm text-gray-500">Veri yok.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Başvuru Durumu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ozet && Object.keys(ozet.basvurular).length > 0 ? (
              Object.entries(ozet.basvurular).map(([durum, n]) => {
                const m = Math.max(1, ...Object.values(ozet.basvurular));
                return (
                  <BarRow key={durum} label={ILAN_DURUM_LABEL[durum] ?? durum} count={n} max={m} />
                );
              })
            ) : (
              <p className="text-sm text-gray-500">Başvuru yok.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Son İlanlar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ilanlar.length === 0 ? (
            <EmptyState icon={<FileText />} title="Henüz ilan yok" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Başlık</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Başlangıç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ilanlar.slice(0, 8).map((ilan) => (
                  <TableRow key={ilan.id}>
                    <TableCell className="font-medium text-gray-900">
                      <Link href={`/admin/ilanlar/${ilan.id}`} className="hover:underline">
                        {ilan.baslik}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <DurumBadge durum={ilan.durum} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

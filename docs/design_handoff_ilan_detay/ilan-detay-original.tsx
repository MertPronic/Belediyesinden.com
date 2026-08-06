'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Ban, Check, CheckCircle2, FileText, Gavel, Trophy, Upload, X } from 'lucide-react';
import { apiFetch, downloadFile, getTenantSlug } from '../../../../lib/api';
import { RequireTenantAdmin } from '../../../../components/require-tenant-admin';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, cn, DurumBadge,
  EmptyState, Field, FieldLabel, Input, Select, useToast,
} from '@belediyesinden/ui';

// NOT: Bu, bu sohbette paylaşilan MEVCUT sayfa kaynagidir; handoff README'nin
// referans aldigi orijinal. Yeniden duzenleme bunun uzerine uygulanmalidir.
// Tam kaynak icin sohbetteki yapistirilan metne bakin — burada dosya, paketin
// kendi kendine yeterli olmasi icin referans olarak tutulmustur.
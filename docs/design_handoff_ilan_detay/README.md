# Handoff: İlan Detay Sayfası — Yeniden Düzenleme (Admin)

## Amaç (Overview)
Mevcut `AdminIlanDetayPage` sayfasının **görsel düzenini ve kullanıcı deneyimini** iyileştirmek. Tek sütunlu, üst üste kart yığınından; **iki sütunlu bir admin konsolu** düzenine geçiş. Sağ tarafta sabit (sticky) bir **Durum Yönetimi** paneli ve bir **durum ilerleme adımı (stepper)** var. Fonksiyonellik, API sözleşmesi ve iş kuralları **birebir korunuyor** — bu yalnızca bir arayüz/yerleşim yenilemesi.

## ÖNEMLİ — Projenin prensiplerinden vazgeçmeden uygula
Bu paketteki `Ilan Detay.dc.html` dosyası bir **tasarım referansıdır** (HTML prototip). Doğrudan kopyalanacak üretim kodu **değildir**. Prototip, tasarımı standalone göstermek için Nocturne'ün CSS class'larını (`.card`, `.btn`, `.input` …) ve inline stilleri kullanır — **bunları taşımayın.**

Bunun yerine görev: prototipteki **düzeni, hiyerarşiyi ve etkileşim akışını**, projenin kendi ortamında yeniden kurmak. Yani:

- **Kendi bileşen kütüphanenizi kullanın:** `@belediyesinden/ui` → `Button`, `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Field`, `FieldLabel`, `Input`, `Select`, `Badge`, `DurumBadge`, `EmptyState`, `useToast`, `cn`.
- **Mevcut yapıyı koruyun:** `RequireTenantAdmin` sarmalayıcısı, `apiFetch` / `downloadFile` / `getTenantSlug`, Next.js `useParams`/`Link`, `lucide-react` ikonları, `var(--renk, #2563eb)` tema değişkeni ve Tailwind class'ları.
- **Hiçbir iş kuralını değiştirmeyin:** tüm `PATCH /ilan/:id`, `POST /ilan/:id/durum`, `POST /ilan/:id/sonuclandir`, evrak/görsel yükleme çağrıları, `window.confirm` onayları, doğrulama kontrolleri (şartname tutarı > 0, lat/lng birlikte girilmeli, zorunlu belge sayacı) aynen kalır.

Kısacası: **iskeleti ve UX'i al, teknolojiyi ve kuralları bizden koru.**

## Fidelity
**Hi-fi (düzen/UX açısından).** Yerleşim, gruplama, boşluk ritmi ve etkileşim akışı nettir ve birebir hedeflenmelidir. Ancak renk/tipografi/gölge değerleri **Nocturne'e ait** olduğundan bunları taklit etmeyin — projenin mevcut Tailwind + `--renk` tema sistemiyle stillendirin. Yani: **düzen hi-fi, stil ise projenin kendi sistemiyle.**

---

## Ekran: İlan Detay (tek sayfa)

### Genel yerleşim
Mevcut `<div className="space-y-6">` tek sütunu, şu grid ile değiştirin:

- **Üst şerit (isteğe bağlı):** basit bir breadcrumb — `İhale Yönetimi / İlanlar / Detay`. İsterseniz atlayabilirsiniz; kritik değil.
- **Geri linki:** `İlanlara dön` (mevcut `<Link href="/admin/ilanlar">` aynen kalır).
- **Sayfa başlığı satırı:** solda `ilan.baslik` (büyük başlık) + altında `ihale_tipi · İşlem Türü` alt satırı; sağda `<DurumBadge durum={ilan.durum} />`. Bu blok grid'in **üstünde, tam genişlikte** durur.
- **İçerik gridi:**
  ```
  grid, iki sütun: [ minmax(0,1fr)  336px ], gap ~22px, align-items:start
  ```
  Mobilde (< ~900px) tek sütuna düşer (`grid-cols-1 lg:grid-cols-[minmax(0,1fr)_336px]`).

### Sol sütun (ana içerik) — dikey stack, gap ~22px
Sırayla:

1. **Genel Bilgiler kartı** (`<Card>`)
   - Üstte iki kolonlu küçük grid:
     - Sol: kicker "BAŞLANGIÇ BEDELİ" (küçük, harf aralıklı, `--renk` rengi) + altında büyük değer `Number(ilan.baslangic_fiyati).toLocaleString('tr-TR') + ' ₺'`.
     - Sağ: kicker "KONUM" + `lucide-react` `MapPin` ikonu + `[ilan.il, ilan.ilce].filter(Boolean).join(', ')`. `il`/`ilce` yoksa bu blok gizlenir (mevcut koşul).
   - İnce ayraç.
   - `ilan.aciklama` (varsa) — okunur satır yüksekliğiyle gövde metni.

2. **Taslak Düzenle kartı** — yalnızca `ilan.durum === 'TASLAK'` iken. İçerik **mevcut formdan birebir**:
   - `Açıklama` textarea (`aciklama` state).
   - İki kolonlu grid: `İlan Tarihi*`, `İhale Tarihi*` (her ikisinin altında mevcut "en az 10 gün" yardım metni), `Enlem (lat)`, `Boylam (lng)` (yardım metniyle).
   - `Şartname bedeli ücretli` checkbox → işaretliyse `Şartname Tutarı (₺)*` alanı.
   - `Katılım Şartları*`: `KATILIM_SARTLARI` üzerinde iki kolonlu **toggle buton** ızgarası (mevcut markup birebir — seçili durumda `--renk` kenarlık + `color-mix` dolgu + yuvarlak `Check` işaretli nokta).
   - **Not:** Bu kart artık "Taslağı Kaydet"/"Yayınla" butonlarını **içermez** — o butonlar sağ paneldeki Durum Yönetimine taşındı (aşağıya bakın).

3. **Şartname / Evrak kartı** (`<Card>`) — mevcut içerik:
   - `TASLAK` iken: `Zorunlu belgeler: {zorunluTamamlanan}/3` sayacı + `ZORUNLU_EVRAK_TIPLERI` için yeşil/nötr rozetler (mevcut `Check`/`X` mantığı).
   - Yükleme satırı: `Evrak Kategorisi` `<Select>` + dosya seç input + `Evrak Yükle` butonu (`evrakYukle` aynen). İpucu: seç + buton + seçili dosya adını **tek satırda, flex-wrap ile** hizalayın (daha derli toplu).
   - Yüklü evrak listesi: dosya adı + `<Badge>` tip etiketi + `İndir` butonu (`downloadFile` aynen).

4. **İlan Görselleri kartı** (`<Card>`) — mevcut galeri: 5 kolonlu grid (mobilde 3) + çoklu görsel yükleme formu (`gorselYukle` aynen). Görsel `src` mevcut `${API_URL}/ilan/gorsel/${g.id}?tenant=${getTenantSlug()}` kalır.

### Sağ sütun (sidebar) — `position: sticky; top: ~80px`, gap ~22px

1. **Durum Yönetimi kartı** (`<Card>`, hafif yükseltilmiş / `elev-md` benzeri gölge)
   - **Durum adımları (stepper) — YENİ:** `TASLAK → YAYINDA → CANLI_ARTIRMA → SONUCLANDI` sırası dikey listelenir. Mevcut durumdan öncekiler "tamamlandı" (dolu nokta + tik), mevcut olan "aktif" (halka + hafif glow), sonrakiler "bekliyor" (soluk). `IPTAL` durumunda stepper **gizlenir** (bu durum akış dışı bir terminal). Bu tamamen görsel bir yardımcıdır — herhangi bir state gerektirmez, sadece `ilan.durum`dan türetilir.
   - **Aksiyon butonları — mevcut durum makinesi birebir korunur** (yalnızca konumları bu panele taşındı):
     - `TASLAK`: `Taslağı Kaydet` (secondary, `taslakKaydet`) + `Yayınla` (primary, `CheckCircle2`, `durumDegistir('YAYINDA', …)`).
     - `YAYINDA`: `İhaleyi Başlat` (primary, `Gavel`, `durumDegistir('CANLI_ARTIRMA', …)`) + `İptal Et` (kırmızı outline, `Ban`, `durumDegistir('IPTAL', …)`) + mevcut "İhale tarihi gelmeden…" yardım metni.
     - `CANLI_ARTIRMA`: `Sonuçlandır` (primary, `Trophy`, `sonuclandir`) + `İptal Et`.
     - `IPTAL`: `<EmptyState icon={<Ban/>} title="Bu ilan iptal edilmiş" …/>`.
     - `SONUCLANDI`: `<EmptyState icon={<Trophy/>} title="İhale sonuçlandı" …/>`.
   - Butonlar burada **tam genişlik (block)** ve dikey stack olarak dizilir.

2. **Özet kartı — YENİ (isteğe bağlı, küçük)**
   - Etiket/değer satırları: İhale Tipi, İşlem Türü, İlan Tarihi, İhale Tarihi, Şartname (ücretsiz / tutar). Hepsi `ilan`dan okunur; yeni veri gerektirmez. İsterseniz atlanabilir.

---

## Etkileşim & Davranış (aynen korunur)
- Tüm durum geçişleri `window.confirm(onayMesaji)` ile onaylanır (mevcut metinler birebir).
- `taslakKaydet` doğrulamaları: şartname ücretliyse tutar > 0; lat/lng ikisi birlikte ya da ikisi de boş. Hata → `toast.error`, başarı → `toast.success` + `yukle()`.
- Yükleme butonlarında `loading` state (`uploading`, `gorselUploading`, `busy`, `taslakSaving`) mevcut haliyle kalır.
- Yükleniyor iskeleti (`yukleniyor`) ve `ilan` yoksa `EmptyState` mevcut haliyle kalır.
- `stepper` yalnızca sunumdur; tıklanabilir değildir — durum değişimi yalnızca mevcut aksiyon butonlarıyla olur.

## State Management (değişiklik yok)
Mevcut tüm state'ler aynen kalır: `ilan, file, evrakTipi, evraklar, uploading, gorselFiles, gorselUploading, gorseller, busy, yukleniyor` + taslak formu (`aciklama, ilanTarihi, ihaleTarihi, sartnameUcretli, sartnameTutari, katilimSartlari, lat, lng, taslakSaving`). Yeni state **eklenmez**; stepper `ilan.durum`dan türetilir.

## Tasarım Token'ları
Nocturne prototipinin hex değerlerini **kullanmayın**. Projenin kendi sistemiyle stillendirin:
- **Vurgu rengi:** `var(--renk, #2563eb)` (mevcut kullanım — kicker, seçili toggle, primary vurgu).
- **Nötrler/metin/kenarlık:** mevcut Tailwind `gray-*` skalası (`text-gray-900/700/500/400`, `border-gray-100/200`, `bg-gray-50/100`).
- **Durum semantiği:** başarı için `emerald-*`, tehlike/iptal için `red-600` (mevcut kullanım).
- **Köşe/gölge/boşluk:** mevcut `rounded-lg/xl`, kart gölgeleri ve `space-y`/`gap` ritmi.
- **Sidebar genişliği:** 336px; grid gap 22px; sticky offset ~80px. Bunlar Tailwind ile: `lg:grid-cols-[minmax(0,1fr)_336px] gap-[22px]`, panel `sticky top-20`.

## Assets
Yeni asset yok. İkonlar `lucide-react`ten (`ArrowLeft, Upload, Check, X, FileText, CheckCircle2, Gavel, Trophy, Ban, MapPin`). Prototipteki Phosphor SVG'leri **kullanılmaz** — lucide karşılıklarını kullanın (`MapPin` yeni eklenen tek ikon).

## Dosyalar
- `Ilan Detay.dc.html` — tasarım referansı (yerleşim + etkileşim akışı için bak). Stil/teknoloji referansı değildir.
- `ilan-detay-original.tsx` — yeniden düzenlenecek mevcut sayfa kaynağı (bu sohbette paylaşılan hali).

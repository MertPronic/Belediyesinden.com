# ILERLEME.md — Oturum Sürekliliği (Nerede miyiz?)

> Amaç: her yeni Claude Code oturumunun açılışında "şu an neredeyiz, sırada ne var"ı
> tek bakışta vermek. `YOL-HARITASI.md` makro (İş Paketleri) seviyesinde durum tutar;
> bu dosya aktif **dikey kesit**in adım adım ilerlemesini tutar.
> Canlı belge — her oturum sonunda güncellenir. Sürüm geçmişi tutulmaz, üzerine yazılır.
>
> **Durum kodları:** ✅ bitti · 🔄 sürüyor · ⬜ başlanmadı
>
> Son güncelleme: 2026-08-03

---

## Aktif kesit: İhale başlangıcından sonuçlanmaya (canlı artırma + teklif verme)

Önceki kesit (ilan-çıkma) tamamlandı; bu kesit ilan yayınlandıktan sonra ihalenin
başlatılması, teklif verilmesi ve sonuçlandırılmasını kapsıyor.

| Adım | Ne | Durum |
|---|---|---|
| 1 | `CANLI_ARTIRMA` durum makinesi: ihale tarihi gelmeden başlatılamaz, teklif sadece `CANLI_ARTIRMA`'da, sonuçlandırma tamamen manuel | ✅ |
| 2 | Katılım şartı: onaylı başvuru + bloke teminat olmadan teklif verilemez (backend-otoriter) | ✅ |
| 3 | İhale kuralları floor + tenant override (asgari 10 gün, TENANT_ADMIN kendi kurallarını düzenleyebiliyor) | ✅ |
| 4 | "İhalelerim" sayfası + ilan sayfası/teklif verme ayrımı (ilan=duyuru, teklif=katılım) | ✅ |
| 5 | Canlı teklif deneyimi: gerçek görsel, drop-in animasyon, "şu an sizde" göstergesi, katılımcı adı (maskeli), kayan geçmiş | ✅ |
| 6 | **Kritik bug:** WebSocket hiçbir vatandaş için bağlanamıyordu → düzeltildi | ✅ |
| 7 | **Kritik bug:** aynı ilana eşzamanlı teklifte yarış durumu → `FOR UPDATE` ile düzeltildi | ✅ |
| 8 | Açık/kapalı teklif ayrımı (canlı teklif sayfası hâlâ ihale tipine bakmaksızın aynı) | ⬜ |

### Adım 1 — CANLI_ARTIRMA durum makinesi
`libs/ilan-core/src/lib/ihale-baslat-dogrula.ts` (yeni, testli): `ihaleBaslatDogrula(ihaleTarihi, now)`. `IlanService.changeDurum()` YAYINDA→CANLI_ARTIRMA geçişinde bunu çağırıyor; `sonuclandir()` artık `CANLI_ARTIRMA` şartı arıyor (önceden `YAYINDA`'ydı). `TeklifService.submit()` da `CANLI_ARTIRMA` şartı arıyor. Admin panelinde "İhaleyi Başlat"/"Sonuçlandır" ayrı butonlara bölündü.

### Adım 2 — Katılım şartı
`TeklifService.submit()`'e `basvuru` tablosunda `ilan_id + kullanici_id + durum=ONAYLANDI` kontrolü eklendi. Daha önce **hiç kontrol yoktu** — başvurmamış biri bile teklif verebiliyordu, testte fark edildi.

### Adım 3 — İhale kuralları floor + override
`libs/rule-engine`: `ILAN_KURALLARI_ASGARI` (10/10 gün, 2886 kanuni asgari) + `ilanKurallariGuncellemeGecerliMi`. Yeni `apps/api/src/ilan-kurallari` modülü (`GET/PATCH /api/ilan-kurallari`, sadece TENANT_ADMIN — ENCÜMEN dışarıda tutuldu, kullanıcı kararı). Yeni admin sayfası `/admin/kurallar`.

### Adım 4 — İhalelerim sayfası
Kullanıcı kararıyla: ilan detay sayfası (`/ilanlar/[id]`) artık **hiç** teklif verme aksiyonu içermiyor, sadece bilgilendiriyor. Teklif verme akışı tamamen `/ihalelerim` (onaylı başvurular, ilan durumuna göre gruplu) → `/teklif/[ilanId]` üzerinden. `GET /api/basvuru/ihalelerim` yeni endpoint.

### Adım 5 — Canlı teklif deneyimi
`/teklif/[ilanId]`: kapak görseli + başlık/durum overlay, `bid-drop-in` CSS animasyonu (yeni teklif satırı), en yüksek teklif değişince pulse efekti, "Şu anda en yüksek teklif sizde!" banner'ı (kullanıcı sub karşılaştırması), teklif geçmişinde "Siz" etiketi, katılımcı adı (`teklif.kullanici_ad`, yeni migration — **sadece açık artırmada**, kapalı/açık teklifte backend `NULL` döndürüyor), red alınca input otomatik güncel minimuma dolduruluyor, geçmiş tablosu `max-h-96` + sticky header (sayfa artık sonsuz uzamıyor).

### Adım 6 — WS bağlantı bug'ı (kritik)
`AuctionGateway`, tenant'ı sadece JWT'nin `tenant_groups` claim'inden çözüyordu — vatandaş/yatırımcı kullanıcılar **bilerek** hiçbir tenant grubuna bağlı değil, yani **hiçbir sıradan vatandaş bugüne kadar canlı teklif akışına gerçekten bağlanamıyordu** ("Bağlanıyor..." takılı kalıyordu). WS URL'ine `?tenant=` fallback eklendi (teklif verisi zaten public/tenant-bazlı şeffaf olduğu için risksiz).

### Adım 7 — Eşzamanlı teklif yarış durumu (kritik)
`TeklifService.submit()`'in ilk sorgusuna `FOR UPDATE` eklendi — aynı ilana çakışan teklifleri satır kilidiyle sıraya sokuyor. **Gerçek testle kanıtlandı:** aynı ilana aynı anda aynı tutarla 20 istek → 1 kabul + 19 red; ayrıca 3 farklı gerçek kullanıcıyla (Ahmet/Ayşe/Mehmet) tekrarlandı, aynı sonuç. `docs/ACIK-SORULAR.md`'deki KK-17 artık kapalı.

### Sıradaki adım (öneri, henüz karar verilmedi)
Adım 8 — açık/kapalı teklif ayrımı. Şu an `/teklif/[ilanId]` ihale tipine bakmaksızın aynı canlı tabloyu gösteriyor; kapalı teklifte ilkesel olarak kimse (kimlik ya da tutar) sonuçlanana kadar görmemeli. Bu, Harun/Murat ile netleşmeden ellenmedi (bkz. `ACIK-SORULAR.md`).

---

## Commit / çalışma ağacı durumu (ACİL DİKKAT)

`git status` şu an **hiçbir şey commit'lenmemiş** durumda — son commit hâlâ `aaec6bc`
("docs: mimari belge seti + ilan-çıkma kesit planı"), yukarıdaki 8 adımın **tamamı** dahil
olmak üzere çok sayıda dosya (backend + frontend + migration + docs) çalışma ağacında
bekliyor. CLAUDE.md'nin "sürüm kontrolü zorunlu / commit'siz iş yok" kuralı gereği bir
sonraki oturuma geçmeden önce bunların gözden geçirilip commit'lenmesi (muhtemelen birkaç
mantıklı parçaya bölünerek) gerekiyor.

---

## Açık / onay bekleyen kararlar

Bkz. `docs/ACIK-SORULAR.md` — bu kesitten çıkan yeni sorular oraya eklendi (S9-S12).

---

## Bu dosyayı nasıl kullan

Her oturum başında `CLAUDE.md` + `DECISIONS.md` + `YOL-HARITASI.md`'nin yanına bunu da oku — "aktif kesit hangi adımda, ne değişti, ne commit'lenmedi" tek yerden görülür. Kesit değişirse üst tablo o kesite göre sıfırlanır, ayrıntı geçmişi silinir — kalıcı gerekçe kaydı `DECISIONS.md`'de kalır, burası sadece anlık durum.

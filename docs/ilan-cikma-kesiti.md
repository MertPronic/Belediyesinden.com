# İlan-Çıkma Dikey Kesiti — İlk Claude Code Oturumu

> İlk pilot kesiti. Bir belediye personelinin bir varlık için ilan oluşturup
> **TASLAK → YAYINDA**'ya alması; ilanın portal + tenant-web listelerinde görünmesi.
> Akışın başı budur — ilan olmadan başvuru/teminat/teklif olmaz.
>
> Bu dosyayı ilk Claude Code oturumunda bağlam olarak kullan. Kurallar `CLAUDE.md` + `DECISIONS.md`.

---

## Değişmez kurallar (özet)

- **Stil:** functional-core / imperative-shell. **`TeklifService` referans şablon** (KK-16).
- **Kalıcılık:** `rawQuery(qr, sql, $params)`; `qr = getCurrentTenant().queryRunner`. String-birleştirmeli SQL yok (KK-03).
- **Durum geçişleri backend'de zorlanır.** Güvenlik backend-otoriter — istemci sadece gösterir.
- **Her mutasyon → `appendAuditLog(...)`** (fire-and-forget).
- **İzolasyon:** tüm sorgular `qr()` üzerinden; taze bağlantı yasak.

---

## Adım 0 — git (şimdi, remote beklemeden)

```
git init
# .gitignore: node_modules, dist, .env, *.log, coverage, .nx/cache
git add -A
git commit -m "chore: mevcut kod tabanı + mimari belge seti (devralma)"
```
Remote mail'le geldiğinde: `git remote add origin <url> && git push -u origin main`.

---

## Adım 1 — Ground truth (YAZMADAN ÖNCE OKU)

Şu dosyaları oku, "ne var / ne eksik" raporu çıkar:
- `apps/api/src/ilan/` → `ilan.entity.ts`, `ilan.service.ts`, `ilan.controller.ts`, `ilan.module.ts`
- `apps/api/src/varlik/` → varlık modeli (ilan bir varlığa bağlanır)
- `apps/api/src/evrak/` → belge/şartname (ilk kesitte opsiyonel)
- `libs/shared` enum'ları → `IlanDurumu`, `IhaleTipi`, `VarlikTipi` (yeniden kullan, yeniden tanımlama)
- `libs/audit` → `appendAuditLog` imzası

**Çıktı:** `DECISIONS.md` / `YOL-HARITASI.md`'deki `ilan`/`varlik` 🟡 durumlarını gerçeğe göre güncelle. İlan modülü ne kadar dolu?

---

## Adım 2 — Kesit tanımı (rapora göre eksikleri planla)

Uçtan uca yol:
1. Varlık oluştur / seç (tenant'a ait, `VarlikTipi` + jsonb detay)
2. İlan oluştur → `durum = TASLAK` (baslik, aciklama, varlik_id, ihale_tipi, baslangic_fiyati, baslangic_tarihi, bitis_tarihi)
3. *(ops.)* Evrak ekle → MinIO pre-signed
4. **Yayınla → TASLAK → YAYINDA**

Adım 1 raporuna göre bu 4 parçadan hangileri var/eksik netleşsin; sonra yaz.

---

## Adım 3 — Backend (server-authoritative, TeklifService deseni)

`IlanService`:
- `create(dto)` → `durum = TASLAK` yaz, audit(`ILAN_CREATE`).
- `publish(id)` → **saf doğrulama** (zorunlu alanlar dolu mu; `bitis > baslangic > now`; varlık var ve tenant'a ait mi; `ihale_tipi` geçerli mi) → geçerliyse `durum = YAYINDA`, audit(`ILAN_PUBLISH`); değilse `BadRequestException`. Zaten YAYINDA ise / geçersiz geçiş reddedilir.
- Doğrulama mantığını saf bir fonksiyona ayır (functional-core; `auction-core`'daki `teklif-validator` gibi test edilebilir olsun).

`IlanController`:
- `@Roller(TENANT_ADMIN)` — yalnız belediye personeli yayınlar.
- DTO'lar `class-validator` ile.
- Tüm sorgular `qr()` üzerinden, parametreli.

---

## Adım 4 — İnce UI (tenant-web admin)

- İlan oluştur/düzenle formu + **"Yayınla"** butonu.
- İstemci sadece gösterir; tüm doğrulama backend'de. (Portal public listesi ayrı, küçük bir sonraki adım.)

---

## Adım 5 — Test (bitiş kapısı)

e2e / entegrasyon:
- TENANT_ADMIN: varlık → ilan taslak → publish → `GET` ilanı `YAYINDA` döner.
- **Cross-tenant:** başka tenant bu ilanı göremez/düzenleyemez.
- **Geçersiz geçiş:** `bitis < baslangic` → red; zaten YAYINDA olanı tekrar publish → red.
- `publish` doğrulayıcısının saf birim testi (sınır koşulları).

---

## Kesit "bitti" sayılır:

✅ İki farklı tenant context'inde ilan izole · ✅ bir ilan TASLAK→YAYINDA geçip listede görünüyor · ✅ audit'e `ILAN_PUBLISH` düştü · ✅ testler yeşil.

Sonraki kesit: **başvuru** (yayındaki ilana vatandaş başvurusu).

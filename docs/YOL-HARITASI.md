# YOL-HARITASI.md — İş Paketi × Mevcut Durum × Pilot Omurga

> Canlı belge. Vizyon İş Paketleri ile kodun gerçek durumunu yan yana koyar,
> pilota giden omurgayı önceliklendirir.
> **Durum:** ✅ çalışıyor · 🔧 sağlamlaştırma gerek · 🟡 var ama olgunluk teyit edilecek · ⬜ yapılmadı
>
> Sürüm: v0.2 · Kod incelemesi sonrası

---

## Kuzey Yıldızı

**Tek belediye, tek gerçek açık artırma** — başvurudan sonuçlanmaya kadar, izole ve denetlenebilir. Bunu uçtan uca çalıştıran en kısa dikey kesit = **omurga**. Geri kalan (banka, e-Devlet, k8s, raporlama derinliği, çoklu-instance ölçek) bu omurga çalıştıktan sonra sıraya girer.

---

## İş Paketleri × Gerçek Durum (kod incelemesi sonrası)

| İP | Vizyondaki tanım | Kodda gerçekte | Durum |
|----|------------------|----------------|-------|
| İP1 | Analiz & sistem mimarisi | Diyagram + faz-0 + 5 belge seti + v2 diyagram | ✅ baz |
| İP2 | Çok kiracılı altyapı | tenancy dolu (migrations 14KB), guard zinciri, izolasyon **çalışıyor**; SQLi kapandı (KK-07) | ✅ (kalan: ingress header-strip) |
| İP3 | İlan & varlık | `ilan`+`varlik` **dolu** (CRUD, roller, audit, arama, görsel); publish sağlamlaştırılacak (state-machine → ilan-core, KK-20 tarihler). **Kapsam genişliyor:** ilan artık 1 varlık değil N varlık ("kalem") içerebilecek — bkz. KK-25, fazlanmış uygulama sürüyor | ✅ dolu / 🔧 publish / 🟡 KK-25 fazlanıyor |
| İP4 | Başvuru & teminat | `basvuru`, `teminat` modülleri mevcut; teminat **simülasyon** (stub) | 🟡 olgunluk teyit |
| İP5 | Gerçek zamanlı açık artırma motoru | **Çalışıyor**: `TeklifService` zinciri tam (doğrula→yaz→WS→audit→anti-sniping), `auction-core` testli, gateway güvenli relay | 🔧 sağlamlaştır (KK-17, KK-18) |
| İP6 | Dinamik kural motoru | `rule-engine` kullanılıyor (`getIlanKurallari`); `ilan_kurallari` tablosu | 🟡 kapsam teyit |
| İP7 | Raporlama & karar destek | `rapor` modülü mevcut | ⬜ pilot sonrası |
| İP8 | Pilot belediye & saha | — | 🎯 **HEDEF** |

> Not: "🟡 olgunluk teyit" = modül klasörü var ama içindeki service/controller ne kadar dolu, tek tek açıp göreceğiz. (Örn. `audit` modülü ince görüldü: controller 789 bayt.)

---

## Omurga — Güncellenmiş Sıra

0. **git init + ilk commit + `.gitignore`** — kapsamdan bağımsız, hâlâ bekliyor. Bus-factor 1, versiyon kontrolsüz.
1. **Ground truth (büyük ölçüde tamam)** — kesişen katmanlar + açık artırma çekirdeği teyit edildi. Kalan: domain modüllerinin (ilan, başvuru, teminat) iç olgunluğunu tek tek görmek.
2. **Açık artırma pilot-sağlamlaştırma** — KK-17 (eşzamanlı teklif kilidi, tek gerçek bug), KK-18 (süre-uzadı WS event'i), KK-07 (ingress `x-tenant-slug` strip). Motorun kalbi çalışıyor; bu üçü onu pilot-sağlam yapar.
3. **Standart modül şablonu** — `TeklifService`'i referans olarak sabitle (KK-16); eksik/ince modülleri bu desenle tamamla.
4. **Uçtan uca senaryo** — demo tenant → ilan yayınla → başvuru → teminat(sim) → canlı açık artırma → sonuçlan → audit zinciri.
5. **e2e test** — cross-tenant izolasyon + anti-sniping + eşzamanlı teklif.
6. **Pilot uyarlaması** — aday belediye ihtiyacına göre (PO ile).

---

## Bilinçli Ertelenenler (omurga sonrası)

Gerçek banka/POS · e-Devlet · gerçek e-imza (KamuSM) · OpenSearch · k8s prod · çok-instance ölçek + read replica · penetrasyon/load test · raporlama derinliği · `auction-service`'e bidding ayrımı · CDC. Hepsi hedef mimaride var, gerekçeleri `DECISIONS.md`'de.

---

## Açık Sorular (PO / sahip ile — detay: ACIK-SORULAR.md)

1. Grant bağlamı (İş Paketi takvimini bağlar mı)? → S1
2. Yakın kilometre taşı (pilot demo / grant raporu / sağlamlaştırma)? → S2
3. Aday ilk belediye var mı? → S3
4. Pilotta teminat simülasyon kalabilir mi? → S4
5. k8s teslim taahhüdü mü? → S5
6. Pilotta ayrı read-DataSource soyutlaması baştan mı? → S6
7. **Teklif yaşam döngüsü:** teklif anında `kabul_edildi=true` yazılıyor; geri çekme/itiraz/encümen onayı için ara durum gerekli mi? (2886/encümen — mevzuat) → S7

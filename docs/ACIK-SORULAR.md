# AÇIK-SORULAR.md — Netleşmeyi Bekleyenler

> Harun (PO) / Murat (sahip) görüşmelerine bununla girilir. Cevaplanınca ilgili
> karar `DECISIONS.md`'de "kapandı" olarak güncellenir.
>
> Sürüm: v0.2

| # | Soru | Kime | Neyi belirler |
|---|------|------|---------------|
| S1 | Vizyon dökümanı bir grant başvurusuna mı (TÜBİTAK/KOSGEB/Teknopark) bağlı? | Murat | İş Paketi takvimi + belgeleme yükümlülüğü |
| S2 | Yakın kilometre taşı: pilot demo · grant ara raporu · iç sağlamlaştırma? | Murat / Harun | Omurganın hedef tarihi ve önceliği |
| S3 | Konuşulan/aday ilk belediye var mı? | Murat / Harun | Omurga jenerik mi, o belediyeye mi çizilir |
| S4 | Pilotta teminat simülasyon kalabilir mi, yoksa gerçek tahsilat baştan şart mı? | Harun | İP4 kapsamı + gerçek banka aciliyeti (KK-06) |
| S5 | k8s bir teslim/grant taahhüdü mü, tek host'a inebilir miyiz? | Murat / grant metni | KK-12'yi kapatır |
| S6 | (Teknik lider çağrısı) Pilotta ayrı read-DataSource soyutlaması baştan kurulsun mu? | Mert | KK-14'ün pilot uygulaması |
| S7 | Teklif yaşam döngüsü: teklif anında kabul mü ediliyor kalmalı, yoksa geri çekme/itiraz/encümen onayı için ara durum mu gerek? | Harun | Teklif durum modeli + 2886/encümen uyumu |
| S8 ✅ | İlan/ihale tarihini kim belirler; 2886 min askı süresi? | Harun | **KAPANDI:** personel girer, min ilan-ihale aralığı kuraldan (varsayılan 10 gün), max yok → KK-20 |
| S9 | Kapalı teklif usulünde canlı teklif sayfası (kimlik + tutar) hiç gösterilmemeli mi? Şu an tüm ihale tiplerinde aynı açık-artırma-tarzı görünüm kullanılıyor. | Harun | Teklif sayfasının ihale tipine göre ayrışıp ayrışmayacağı |
| S10 | Açık artırmada katılımcı adının kısaltılmış gösterilmesi ("Ahmet Y.") KVKK açısından yeterli mi, ek bir açık rıza metni mi gerekiyor? | Harun (belki hukuk) | Mevcut implementasyonun (bkz. `teklif.kullanici_ad`) onayı/gözden geçirilmesi |
| S11 | İhale kuralları (min artırma, teminat oranı, gün floor'ları) düzenleme yetkisi sadece TENANT_ADMIN'de mi kalsın, ENCÜMEN de girsin mi? | Harun | Şu an TENANT_ADMIN-only (kullanıcı geçici kararı) — `/admin/kurallar` |
| S12 | Kanuni asgari süre (10 gün) üç ihale tipinde de aynı mı kalsın, yoksa tipe göre farklı asgari süreye mi tabi olmalı? | Harun | `ILAN_KURALLARI_ASGARI` şu an tek/global değer |
| S13 | İhale sonuçlandırma tamamen manuel (otomatik zamanlayıcı yok, personel "Sonuçlandır"a basana kadar açık kalıyor) — bu yeterli mi, yoksa süre dolunca otomatik uyarı/bildirim gerekiyor mu? | Harun | Sonuçlandırma akışının (option A, provizyonel) kesinleşmesi |
| S14 | Bir kullanıcı (kimliksiz vatandaş ya da başka belediyenin admin'i fark etmez) herhangi bir belediyenin genel/vatandaş sayfalarını (ana sayfa, ilan listesi, ilan detayı) — kendi belediyesi olmasa da — sıradan bir vatandaş gibi gezebiliyor; sadece `/admin` altı o belediyenin kendi personeliyle sınırlı (`TenantGuard` + `RequireAdmin` ile doğrulandı, KK-24 civarı test edildi). Bu cross-tenant genel görünürlük kasıtlı/istenen bir davranış mı, yoksa vatandaş tarafı da kendi belediyesiyle mi sınırlanmalı? | Harun | Vatandaş/genel sayfaların cross-tenant görünürlük kapsamının onayı |
| S15 | İlan oluşturma akışı şu an iki adımlı: önce küçük bir "taslak" formu (Başlık, Varlık, İhale Tipi, İşlem Türü, Başlangıç Fiyatı, İlan/İhale Tarihi) ile kayıt oluşturuluyor, ardından ayrı bir sayfada asıl içerik (açıklama, konum lat/lng, katılım şartları, şartname/evrak, ilan görselleri) giriliyor ve Taslağı Kaydet / Yayınla ile ilerleniyor. sahibinden.com'daki gibi tek bir "yeni ilan" deneyiminde (görseller/evrak dahil) her şeyin bir kerede, kesintisiz doldurulması mı istenir, yoksa mevcut taslak-önce-oluştur-sonra-zenginleştir yapısı mı korunsun? (Not: dosya yüklemeleri backend'de `ilan_id`'ye FK ile bağlı olduğundan tamamen "önce hiçbir kayıt yok" tek adım teknik olarak mümkün değil — soru UX/algı seviyesinde.) | Harun / Murat | Yeni ilan oluşturma akışının (tek sayfa hissi vs. mevcut iki adım) kapsamı |

## Bize ait (dışarı sormadan karar verebileceğimiz) teknik işler
- **KK-18 · Süre-uzadı WS event'i** — anti-sniping şeffaflığı için.
- **KK-07 artık-risk · ingress `x-tenant-slug` strip** — public yollar için.
- **KK-19 · Auth sadeleştirme** — iki mekanizmadan tek mekanizmaya (düşük öncelik).

## Kapanan kararlar (artık soru değil)
- KK-03 (ORM) ✅ hibrit: raw pg + TypeORM tip · KK-07 (SQLi) ✅ regex savunması · KK-10 (WS izolasyon) ✅ relay güvenli · KK-16 (mimari stil) ✅ functional-core, DDD/Clean rewrite yok.
- **KK-17 ✅ Eşzamanlı teklif kilidi** — `TeklifService.submit()`'e `SELECT ... FOR UPDATE` eklendi. 20 eşzamanlı istek + 3 farklı gerçek kullanıcıyla test edildi: her seferinde tam olarak 1 kabul, gerisi doğru minimuma göre red. Kapandı.
- **WS tenant çözümleme bug'ı ✅** — vatandaş/yatırımcı kullanıcılar `tenant_groups`'a bağlı olmadığı için canlı teklif akışına hiç bağlanamıyordu; `?tenant=` fallback ile düzeltildi (bkz. `ILERLEME.md` Adım 6).

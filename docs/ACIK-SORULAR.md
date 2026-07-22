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

## Bize ait (dışarı sormadan karar verebileceğimiz) teknik işler
- **KK-17 · Eşzamanlı teklif kilidi** — tek gerçek bug; `FOR UPDATE`/koşullu insert. Açık artırma sağlamlaştırmasının 1. maddesi.
- **KK-18 · Süre-uzadı WS event'i** — anti-sniping şeffaflığı için.
- **KK-07 artık-risk · ingress `x-tenant-slug` strip** — public yollar için.
- **KK-19 · Auth sadeleştirme** — iki mekanizmadan tek mekanizmaya (düşük öncelik).

## Kapanan kararlar (artık soru değil)
- KK-03 (ORM) ✅ hibrit: raw pg + TypeORM tip · KK-07 (SQLi) ✅ regex savunması · KK-10 (WS izolasyon) ✅ relay güvenli · KK-16 (mimari stil) ✅ functional-core, DDD/Clean rewrite yok.

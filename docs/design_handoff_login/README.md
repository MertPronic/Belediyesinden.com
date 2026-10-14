# Handoff: Belediyesinden.com — Giriş Ekranı (Login)

## Overview
Belediyesinden.com için yeni giriş (login) ekranı. Mevcut tek kartlı / turkuaz başlıklı ekranın yerine geçer ve **ana sayfanın görsel diliyle** hizalanır: açık gri sayfa zemini, beyaz header, tek beyaz kart içinde solda noktalı desenli koyu teal tanıtım paneli, sağda form. Birincil buton dolgulu teal.

## About the Design Files
Bu paketteki HTML dosyası bir **tasarım referansıdır** — hedeflenen görünüm ve davranışı gösteren bir prototiptir, doğrudan kopyalanacak üretim kodu değildir. Görev, bu tasarımı hedef kod tabanının kendi ortamında (Angular — ekran görüntülerindeki `localhost:4200` buna işaret ediyor) mevcut bileşen, stil ve tema desenleriyle **yeniden oluşturmaktır**. Renk/tipografi/boşluk değerleri projede zaten token olarak varsa bu README'deki hex'ler yerine o token'lar kullanılmalı; README değerleri ana sayfa ekran görüntülerinden okunmuştur.

Dosya: `Giris Ekrani.dc.html` — tarayıcıda doğrudan açılır. Tüm ölçüler markup içinde inline stil olarak durur; şifre göster/gizle davranışı çalışır.

## Fidelity
**High-fidelity.** Renkler, tipografi, boşluklar, radius'lar ve etkileşim durumları nihai değerlerdedir. UI pixel-perfect yeniden üretilmeli; input/button/checkbox gibi parçalar projenin mevcut bileşenleriyle karşılanmalı.

## Screens / Views

### Giriş ekranı (tek ekran, masaüstü)
**Purpose:** Kullanıcı adı/e-posta + şifre ile oturum açmak; şifre sıfırlama ve kayıt akışlarına çıkış vermek.

**Sayfa iskeleti**
- Kök: `min-height:100vh; display:flex; flex-direction:column`, zemin `#f6f8f8`, metin `#16241f`, font **Plus Jakarta Sans** (400/500/600/700).
- **Header** (ana sayfadakiyle aynı): `display:flex; justify-content:space-between; align-items:center; padding:18px 40px`, zemin `#ffffff`, alt kenar `1px solid #eceeee`.
  - Sol: 44×44px logo karesi, `border-radius:12px`, zemin `#157a63`, içinde 24px beyaz Phosphor "buildings" ikonu; yanında "Belediyesinden.com" — 21px, weight 700, `letter-spacing:-0.02em`; `gap:12px`. Tümü tek link, altı çizgisiz.
  - Sağ: "Tüm İlanlar" — 15px, weight 500, renk `#4a5a56`.
- **Gövde:** `flex:1; display:flex; align-items:center; justify-content:center; padding:40px`.
- **Kart:** `width:100%; max-width:1120px`, `display:grid; grid-template-columns:1.05fr 1fr`, `border-radius:22px`, `overflow:hidden`, zemin `#ffffff`, gölge `0 1px 2px rgba(16,40,36,0.04), 0 18px 48px rgba(16,40,36,0.09)`.

**Sol panel (tanıtım)**
- `padding:52px 48px`, `display:flex; flex-direction:column; justify-content:space-between`, `position:relative; overflow:hidden`, metin `#ffffff`.
- Zemin: `linear-gradient(155deg, #0d4e47 0%, #0a3b36 100%)`.
- Nokta deseni (ana sayfa hero'sundaki desen): mutlak konumlu `inset:0` katman, `background-image: radial-gradient(rgba(255,255,255,0.10) 1.2px, transparent 1.2px)`, `background-size:22px 22px`, `pointer-events:none`.
- Üstte pill: `padding:8px 16px`, `border-radius:999px`, zemin `rgba(255,255,255,0.10)`, kenar `1px solid rgba(255,255,255,0.14)`, 13px weight 500, `gap:8px`; 15px Phosphor "sparkle" ikonu + metin "Türkiye'nin belediye ilan & açık artırma portalı".
- Ortada (`margin:44px 0`): H1 "Belediye ilanlarını tek yerden takip edin" — 38px, weight 700, `line-height:1.15`, `letter-spacing:-0.025em`, `margin-bottom:16px`. Altında 15px/1.6 paragraf, renk `rgba(255,255,255,0.72)`, `max-width:400px`: "Taşınmaz, taşınır, işletme hakkı ve reklam alanı ihalelerine göz atın; başvurunuzu ve teminatınızı elektronik olarak tamamlayın."

**Sağ panel (form)**
- `padding:52px 56px`, `display:flex; flex-direction:column; justify-content:center`.
1. H2 "Hesabınıza giriş yapın" — 27px, weight 700, `letter-spacing:-0.02em`, `margin-bottom:8px`.
2. Alt metin "Kullanıcı adınız veya e-posta adresinizle devam edin." — 14px, `#6b7b77`, `margin-bottom:32px`.
3. Form sütunu: `display:flex; flex-direction:column; gap:20px`.
4. **Kullanıcı adı alanı** — label "Kullanıcı adı veya E-Posta": 13px, weight 500, `#3d4d49`, `margin-bottom:7px`. Input: `height:50px`, `padding:0 14px 0 42px`, 15px, zemin `#ffffff`, kenar `1px solid #dfe4e3`, `border-radius:12px`, placeholder `ornek@belediyesinden.com` (`#9aa8a5`). Solda 18px Phosphor "user" ikonu, `left:14px`, `#9aa8a5`, `pointer-events:none`.
5. **Şifre alanı** — üst satır: solda label "Şifre" (13px/500), sağda 13px weight 500 link "Parolanızı mı unuttunuz?" (`#0f6b5f`); `justify-content:space-between; align-items:baseline`. Input aynı stil + `padding-right:48px`, placeholder `••••••••`, solda 18px "lock" ikonu. Sağ içte 36×36px göz butonu: `right:7px`, `border-radius:9px`, saydam zemin, renk `#7d8c88`; hover'da renk `#0f6b5f` + zemin `rgba(15,107,95,0.08)`. 19px eye / eye-slash ikonu.
6. **"Beni hatırla"** — 14px, `#3d4d49`, `gap:10px`; native checkbox 18×18px, `accent-color:#0f6b5f`, varsayılan işaretli. (Tasarımda açılıp kapanabilir bir seçenek.)
7. **Birincil buton "Oturum aç"** — tam genişlik, `height:52px`, 16px weight 600, beyaz metin, zemin `#0f6b5f`, `border:0`, `border-radius:12px`, `margin-top:4px`. Hover `#0b544a`, active `#094239`.
8. **Ayırıcı** — `margin:28px 0`, `gap:14px`; iki yanda 1px `#e7eae9` çizgi, ortada 12px weight 500 "VEYA", `letter-spacing:0.06em`, `#93a19d`.
9. **İkincil buton "e-Devlet ile giriş yap"** — tam genişlik, `height:50px`, 15px weight 600, metin `#16241f`, zemin `#ffffff`, kenar `1px solid #dfe4e3`, `border-radius:12px`, `gap:10px`, 18px ikon. Hover zemin `#f4f7f6`, kenar `#c9d2d0`. **Not:** ürün e-Devlet girişini desteklemiyorsa bu buton ve üstündeki ayırıcı kaldırılır.
10. **Alt satır** — ortalı, 14px, `#6b7b77`, `margin-top:30px`: "Yeni kullanıcı?" + weight 600 `#0f6b5f` "Kayıt ol" linki (`margin-left:4px`).

## Interactions & Behavior
- Göz butonu: şifre input'unun `type`'ını password ↔ text çevirir, ikon eye ↔ eye-slash. `aria-label="Şifreyi göster"`.
- "Oturum aç": form submit → projenin auth servisi. Enter ile de tetiklenmeli (gerçek `<form>` kullanın).
- "Parolanızı mı unuttunuz?" → şifre sıfırlama; "Kayıt ol" → kayıt ekranı; header'daki logo → ana sayfa, "Tüm İlanlar" → ilan listesi.
- Input hover: kenar `#b9c4c1`. Input focus: kenar `#0f6b5f` + `box-shadow: 0 0 0 3px rgba(15,107,95,0.12)`.
- Klavye focus: `:focus-visible { outline: 2px solid #0f6b5f; outline-offset: 2px; }`. Tarayıcının mavi halkası bırakılmaz. `::selection` `rgba(15,107,95,0.18)`.
- Linkler hover'da `#0b524a` + altı çizili.
- **Prototipte olmayan, uygulamada gereken durumlar:** buton loading (spinner + disabled, `opacity:.6`), alan altında 13px hata metni + `border-color` kırmızı (`#c0392b` öneri), form üstünde genel hata bandı (açık kırmızı zemin, `border-radius:12px`).
- Responsive: ~900px altında kart tek sütuna iner — sol teal panel gizlenir (veya yalnızca pill + H1 üstte kısa bir blok olarak kalır), form `padding:36px 24px`, sayfa `padding:20px`, kart `border-radius:18px`.

## State Management
- `showPassword: boolean` (false)
- `username: string`, `password: string`, `rememberMe: boolean` (true)
- `submitting: boolean`, `error: string | null`

## Design Tokens
Renkler:
- Sayfa zemini `#f6f8f8` · yüzey/kart `#ffffff` · header alt kenar `#eceeee`
- Metin: birincil `#16241f`, ikincil `#6b7b77`, label `#3d4d49`, header link `#4a5a56`, placeholder/ikon `#9aa8a5`, muted `#93a19d`
- Kenarlar: `#dfe4e3` (varsayılan), `#c9d2d0` / `#b9c4c1` (hover), ayırıcı `#e7eae9`
- Marka teal: logo karesi `#157a63`, aksiyon `#0f6b5f`, hover `#0b544a`, active `#094239`, link hover `#0b524a`
- Panel gradyanı `#0d4e47 → #0a3b36` (155deg); panel üzeri beyaz katmanlar `rgba(255,255,255,0.08–0.16)`
- Gölge: `0 1px 2px rgba(16,40,36,0.04), 0 18px 48px rgba(16,40,36,0.09)`; focus halkası `0 0 0 3px rgba(15,107,95,0.12)`

Tipografi: Plus Jakarta Sans. Boyutlar 38 / 27 / 21 / 16 / 15 / 14 / 13 / 12px. Weight: başlık 700, buton/link vurgusu 600, label 500, gövde 400. Negatif letter-spacing yalnızca başlıklarda (-0.02 / -0.025em).

Boşluk: 4 / 7 / 8 / 10 / 14 / 16 / 18 / 20 / 22 / 28 / 30 / 32 / 40 / 44 / 48 / 52 / 56px (ekranda kullanılan gerçek değerler).

Radius: 9 (ikon butonu) / 12 (input, buton, logo) / 18–22 (kart) / 999px (pill).

## Assets
- Görsel/foto yok.
- İkonlar: **Phosphor Icons** (https://phosphoricons.com) — buildings, sparkle, user, lock, eye, eye-slash, plus-circle. Prototipte inline SVG, `fill="currentColor"`. Projede Phosphor paketi varsa o kullanılmalı; logo ikonu zaten ana sayfada mevcut olduğu için oradaki asset tercih edilir.
- Font: Plus Jakarta Sans (Google Fonts) — ana sayfadaki fonta göre okundu; projedeki gerçek font ailesi neyse o kullanılmalı.

## Files
- `Giris Ekrani.dc.html` — tasarım prototipi (tarayıcıda açılır, şifre göster/gizle çalışır).

## Kaynak / Onay gereken noktalar
Sol paneldeki başlık ve alt metin ana sayfanın hero copy'sinden uyarlandı. **"Beni hatırla"** ve **"e-Devlet ile giriş yap"** tasarımcı önerisidir — ürün tarafında karşılığı yoksa kaldırılır.

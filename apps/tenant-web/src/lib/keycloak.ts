'use client';
import Keycloak from 'keycloak-js';

const REALM = process.env['NEXT_PUBLIC_KEYCLOAK_REALM'] ?? 'belediyesinden';
const CLIENT_ID = process.env['NEXT_PUBLIC_KEYCLOAK_CLIENT_ID'] ?? 'tenant-web';
const URL = process.env['NEXT_PUBLIC_KEYCLOAK_URL'] ?? 'http://localhost:8080';
/** Merkezi portal — bir belediye sayfasından çıkış yapınca buraya dönülür (Harun/PO). */
const PORTAL_URL = process.env['NEXT_PUBLIC_PORTAL_URL'] ?? 'https://belediyesinden.com';

let kc: Keycloak | null = null;
let initPromise: Promise<Keycloak> | null = null;

/** Singleton Keycloak instance (client-side PKCE flow). */
export function getKeycloak(): Keycloak {
  if (!kc) {
    kc = new Keycloak({ url: URL, realm: REALM, clientId: CLIENT_ID });
  }
  return kc;
}

/**
 * Keycloak adapter'ı tek seferde başlat (check-sso). Aynı promise paylaşılır
 * (React StrictMode çift-mount ve birden çok component güvenli).
 */
export function initKeycloak(): Promise<Keycloak> {
  if (!initPromise) {
    initPromise = getKeycloak().init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    }).then(() => getKeycloak());
  }
  return initPromise;
}

const POPUP_ADI = 'belediyesinden-giris';
const POPUP_GENISLIK = 480;
const POPUP_YUKSEKLIK = 640;
const PERDE_SINIFI = 'giris-perdesi';

/** Pop-up'ı mevcut tarayıcı penceresinin tam ortasına konumlandırır. */
function popupOzellikleri(): string {
  const sol = Math.round(window.screenX + (window.outerWidth - POPUP_GENISLIK) / 2);
  const ust = Math.round(window.screenY + (window.outerHeight - POPUP_YUKSEKLIK) / 2);
  return (
    `width=${POPUP_GENISLIK},height=${POPUP_YUKSEKLIK},left=${sol},top=${ust},` +
    'menubar=no,toolbar=no,location=no,status=no'
  );
}

/** Pop-up açıkken ana sayfayı hafifçe karartan perde — pop-up kapanınca kaldırılır. */
function perdeyiGoster(): HTMLDivElement {
  const perde = document.createElement('div');
  perde.className = PERDE_SINIFI;
  document.body.appendChild(perde);
  return perde;
}

/**
 * Giriş ekranını ayrı bir sayfaya geçmeden, küçük bir pop-up pencerede açar
 * (Harun/PO: kullanıcı bulunduğu sayfadan ayrılmasın). Pop-up'ın hedefi
 * `/auth/callback` — o sayfa girişi HİÇ işlemez, sadece "bitti" mesajı gönderip
 * kapanır. Gerçek oturum, `redirectUri`'ye geçince Keycloak'ın kendi sessiz
 * "check-sso" akışıyla (artık kurulu olan SSO çerezini görerek) kuruluyor —
 * elle token taşımaya gerek yok.
 */
export function loginPopup(redirectUri: string): void {
  const k = getKeycloak();
  const eskiDavranisaDus = () => k.login({ redirectUri, prompt: 'login' });

  // Pop-up'ı HEMEN (tıklamanın senkron ucunda) boş açıyoruz — `createLoginUrl`
  // asenkron (PKCE code_challenge için WebCrypto kullanıyor); URL'i bekleyip
  // sonra açsaydık tarayıcı bunu kullanıcı jesti saymayıp engelleyebilirdi.
  const popup = window.open('', POPUP_ADI, popupOzellikleri());
  if (!popup) {
    eskiDavranisaDus();
    return;
  }

  const perde = perdeyiGoster();

  k.createLoginUrl({ redirectUri: `${window.location.origin}/auth/callback`, prompt: 'login' })
    .then((girisUrl) => {
      popup.location.href = girisUrl;
      popup.focus();
    })
    .catch(() => {
      popup.close();
      temizle();
      eskiDavranisaDus();
    });

  const kapaliMi = setInterval(() => {
    if (popup.closed) temizle();
  }, 500);

  function mesajGeldi(event: MessageEvent) {
    if (event.origin !== window.location.origin || event.data !== 'kc-login-complete') return;
    temizle();
    window.location.assign(redirectUri);
  }

  function temizle() {
    clearInterval(kapaliMi);
    window.removeEventListener('message', mesajGeldi);
    perde.remove();
  }

  window.addEventListener('message', mesajGeldi);
}

/** Kimliği doğrulanmamışsa login'e yönlendir. */
export async function ensureAuth(): Promise<Keycloak> {
  const k = await initKeycloak();
  if (!k.authenticated) {
    // prompt:'login' — tarayıcıda başka bir kullanıcının SSO oturumu kalmış olsa bile
    // sessizce ona bağlanmasın, her zaman gerçek bir kimlik doğrulama ekranı göstersin.
    await k.login({ redirectUri: window.location.href, prompt: 'login' });
  }
  return k;
}

/** Token gerekirse yenile (5dk eşiği ile). */
export async function getToken(): Promise<string | undefined> {
  const k = await initKeycloak();
  if (k.authenticated) {
    await k.updateToken(30);
    return k.token;
  }
  return undefined;
}

/** Çıkış — belediyenin kendi sayfasında değil, merkezi portalda son bulur. */
export async function logout(): Promise<void> {
  const k = getKeycloak();
  await k.logout({ redirectUri: PORTAL_URL });
}

/**
 * JWT'den çözülen kullanıcı bilgisi (sub, roller, tenantId).
 * tenantId `tenant_<slug>` grup üyeliğinden türetilir (bkz. backend `extractUser`,
 * libs/auth/token-extractor.ts) — ham `tenant_id` claim'i Keycloak'ta hiç set edilmiyor.
 */
export function getUserInfo() {
  const k = getKeycloak();
  const t = k.tokenParsed;
  if (!t) return null;
  const groups = ((t['tenant_groups'] as string[]) ?? (t['groups'] as string[]) ?? []) as string[];
  const tenantGroup = groups.find((g) => g.startsWith('tenant_'));
  return {
    sub: t['sub'] as string,
    ad: (t['preferred_username'] as string) ?? (t['name'] as string) ?? t['sub'],
    roller: ((t['realm_access']?.roles as string[]) ?? []) as string[],
    tenantId: tenantGroup ? tenantGroup.slice('tenant_'.length) : ((t['tenant_id'] as string) ?? null),
  };
}

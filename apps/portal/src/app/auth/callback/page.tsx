'use client';
import { useEffect } from 'react';

/**
 * Pop-up login penceresinin döndüğü hedef. Keycloak buraya `?code=...` ile
 * yönlendirir ama kodu HİÇ kullanmıyoruz — tek amacı, girişin gerçekleştiğini
 * (Keycloak'ın kendi SSO oturum çerezi artık kurulu) ana pencereye haber verip
 * kapanmak. Ana pencere haberi alınca kendini tazeler; o tazelemede Keycloak'ın
 * her zamanki sessiz "check-sso" akışı bu SSO çerezini görüp asıl oturumu kurar.
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage('kc-login-complete', window.location.origin);
      window.close();
    } else {
      // Pop-up dışında (doğrudan) açıldıysa — ana sayfaya dön.
      window.location.replace('/');
    }
  }, []);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-gray-500" />
    </div>
  );
}

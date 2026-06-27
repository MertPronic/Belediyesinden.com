import { type NextRequest, NextResponse } from 'next/server';

/**
 * Cookie bridge: keycloak-js token'ı httpOnly cookie'ya yazar.
 * Bu sayede server component'ler cookies() ile token'a erişebilir (SSR auth).
 *
 * POST /api/auth/token { token } → cookie set
 * DELETE /api/auth/token → cookie clear
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = body['token'];
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token gerekli' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('kc_token', token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15, // 15 dk (Keycloak access token TTL ile uyumlu)
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('kc_token');
  return res;
}

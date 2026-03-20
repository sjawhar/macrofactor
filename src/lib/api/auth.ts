// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = typeof (import.meta as any)?.env === 'object' ? (import.meta as any).env : {};
function getFirebaseApiKey(): string {
  return _env.VITE_FIREBASE_WEB_API_KEY ?? process.env.FIREBASE_WEB_API_KEY ?? '';
}
const BUNDLE_ID_HEADER = { 'X-Ios-Bundle-Identifier': 'com.sbs.diet' };

export async function signIn(
  email: string,
  password: string
): Promise<{ idToken: string; refreshToken: string; uid: string; expiresIn: number }> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${getFirebaseApiKey()}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...BUNDLE_ID_HEADER },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!resp.ok) {
    throw new Error(`Sign-in failed (${resp.status}): ${await resp.text()}`);
  }
  const data = await resp.json();
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    uid: data.localId,
    expiresIn: Number(data.expiresIn),
  };
}

export async function refreshIdToken(
  refreshToken: string
): Promise<{ idToken: string; refreshToken: string; expiresIn: number }> {
  const url = `https://securetoken.googleapis.com/v1/token?key=${getFirebaseApiKey()}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...BUNDLE_ID_HEADER },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  if (!resp.ok) {
    throw new Error(`Token refresh failed (${resp.status}): ${await resp.text()}`);
  }
  const data = await resp.json();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: Number(data.expires_in),
  };
}

/** Decode JWT payload and return the user ID (user_id or sub claim). */
export function getUserIdFromToken(idToken: string): string {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  while (payload.length % 4 !== 0) payload += '=';
  const decoded = atob(payload);
  const claims = JSON.parse(decoded);
  return claims.user_id ?? claims.sub;
}

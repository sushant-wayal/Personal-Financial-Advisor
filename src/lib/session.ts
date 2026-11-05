import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const SESSION_DURATION_MS = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years

function getSigningKey(): Uint8Array {
  const secretKey = process.env.AUTH_SECRET || 'dev-fallback-secret-key-change-in-production';
  return new TextEncoder().encode(secretKey);
}

export interface SessionPayload extends JWTPayload {
  role: string;
  expires: Date | string;
}

export async function encrypt(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10y')
    .sign(getSigningKey());
}

export async function decrypt(input: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(input, getSigningKey(), {
      algorithms: ['HS256'],
    });
    return payload;
  } catch {
    return null;
  }
}

export async function createSession() {
  const expires = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await encrypt({ role: 'admin', expires });

  const cookieStore = await cookies();
  cookieStore.set('auth_session', session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('auth_session')?.value;
  
  if (!session) return null;
  
  const decrypted = await decrypt(session);
  return decrypted;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_session');
}

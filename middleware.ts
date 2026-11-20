import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './src/lib/session';

const publicRoutes = ['/login'];
const publicApiPrefixes = [
  '/api/auth',
  '/api/cron',
  '/api/gmail/webhook',
  '/api/notifications/register-token',
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Public static assets and files
  if (
    path.startsWith('/_next') ||
    path.startsWith('/public') ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get('auth_session')?.value;
  const session = cookie ? await decrypt(cookie) : null;

  // Handle /api routes
  if (path.startsWith('/api')) {
    const isPublicApi = publicApiPrefixes.some((prefix) => path.startsWith(prefix));
    if (isPublicApi) {
      return NextResponse.next();
    }

    if (session) {
      return NextResponse.next();
    }

    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (bearerToken) {
      if (process.env.ADMIN_PASSWORD && bearerToken === process.env.ADMIN_PASSWORD) {
        return NextResponse.next();
      }
      const tokenPayload = await decrypt(bearerToken);
      if (tokenPayload) {
        return NextResponse.next();
      }
    }

    // Block unauthenticated browser requests
    const isBrowserRequest = Boolean(
      request.headers.get('sec-fetch-mode') ||
      request.headers.get('referer')
    );

    if (isBrowserRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.includes(path);

  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  if (isPublicRoute && session && path === '/login') {
    return NextResponse.redirect(new URL('/', request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

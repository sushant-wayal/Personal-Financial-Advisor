import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './src/lib/session';

const protectedRoutes = ['/']; // We will actually protect everything by default
const publicRoutes = ['/login'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Public assets and routes we want to exclude
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.startsWith('/public') ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.includes(path);
  
  const cookie = request.cookies.get('auth_session')?.value;
  const session = cookie ? await decrypt(cookie) : null;

  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  if (isPublicRoute && session && path === '/login') {
    return NextResponse.redirect(new URL('/', request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

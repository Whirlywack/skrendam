import { auth } from '@/auth';

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== '/login') {
    return Response.redirect(new URL('/login', req.nextUrl.origin));
  }
});

export const config = {
  // Only the NextAuth routes are exempt from the auth wall; any future /api/*
  // route handler is protected by default instead of silently public.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};

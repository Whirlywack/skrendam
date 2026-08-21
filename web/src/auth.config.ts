import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: { signIn: '/login' },
  // 8h cap: JWT sessions can't be revoked server-side, so a stolen/forgotten
  // cookie must age out within a working day (Auth.js default is 30 days).
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      if (nextUrl.pathname === '/login') return true;
      return isLoggedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

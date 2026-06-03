import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from './auth.config';

const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(credentials) {
        const parsed = schema.safeParse(credentials);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;
        const expectedUser = process.env.ADMIN_USERNAME;
        const expectedHash = process.env.ADMIN_PASSWORD_HASH;
        if (!expectedUser || !expectedHash) return null;
        const passwordOk = await bcrypt.compare(password, expectedHash);
        if (!passwordOk || username !== expectedUser) return null;
        return { id: 'admin', name: expectedUser };
      },
    }),
  ],
});

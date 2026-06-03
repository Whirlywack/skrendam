import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  out: './src/db/generated',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! },
  schemaFilter: ['public'],
});

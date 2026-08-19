import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'schema.prisma',
  migrations: {
    path: 'migrations',
    seed: `tsx --tsconfig ${process.cwd()}/backend/tsconfig.json ${process.cwd()}/backend/configuration/seed.ts`,
  },
  datasource: {
    url: env('POSTGRES_DATABASE_URL'),
  },
});

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'schema.prisma',
  migrations: {
    path: 'migrations',
    seed: `tsx ${process.cwd()}/configurations/scripts/seed.ts`,
  },
  datasource: {
    url: env('POSTGRES_DATABASE_URL'),
  },
});

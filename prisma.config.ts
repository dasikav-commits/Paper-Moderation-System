import 'dotenv/config';
import { defineConfig } from 'prisma/config';

function resolveDatasourceUrl(): string {
  const directUrl = process.env.DIRECT_URL;
  const databaseUrl = process.env.DATABASE_URL;

  // GitHub Codespaces containers are IPv4-only, whereas `db.<ref>.supabase.co` resolves to IPv6 only.
  // When `DATABASE_URL` points to Supabase's IPv4 pooler (`*.pooler.supabase.com`), automatically use
  // its Session Mode port (:5432) for Prisma CLI commands if `DIRECT_URL` still points to `db.*.supabase.co`.
  if (
    directUrl &&
    directUrl.includes('.supabase.co') &&
    databaseUrl &&
    databaseUrl.includes('.pooler.supabase.com')
  ) {
    return databaseUrl
      .replace(':6543/', ':5432/')
      .replace(/([?&])pgbouncer=true(&?)/, (_, prefix, suffix) =>
        suffix ? prefix : ''
      );
  }

  return (
    directUrl ||
    databaseUrl ||
    'postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable'
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: resolveDatasourceUrl(),
  },
});

import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PRISMA_SCHEMA_ENGINE_BINARY: process.env.PRISMA_SCHEMA_ENGINE_BINARY || process.execPath,
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
  },
});

process.exit(result.status ?? 0);

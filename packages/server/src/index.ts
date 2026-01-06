import 'dotenv/config';
import { buildApp } from './app.js';
import { initPool, closePool } from './db/connection.js';
import { validatePolicyScopeIntegrity } from './validation/startup-validator.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main() {
  initPool({
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'mandate',
    user: process.env.DB_USER ?? 'mandate',
    password: process.env.DB_PASSWORD ?? 'mandate',
  });

  await validatePolicyScopeIntegrity();

  const app = buildApp();

  const shutdown = async () => {
    await app.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: PORT, host: HOST });
}

main();

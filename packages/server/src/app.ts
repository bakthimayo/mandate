import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { decisionsRoutes } from './routes/decisions.js';
import { observabilityRoutes } from './routes/observability.js';
import { specsRoutes } from './routes/specs.js';
import { registerPolicySnapshotRoutes } from './routes/policy-snapshots.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(fastifyCors, {
    origin: true,
  });

  app.register(decisionsRoutes);
  app.register(observabilityRoutes);
  app.register(specsRoutes);
  app.register(registerPolicySnapshotRoutes);

  return app;
}

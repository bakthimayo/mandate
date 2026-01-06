import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { decisionsRoutes } from './routes/decisions.js';
import { observabilityRoutes } from './routes/observability.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(fastifyCors, {
    origin: true,
  });

  app.register(decisionsRoutes);
  app.register(observabilityRoutes);

  return app;
}

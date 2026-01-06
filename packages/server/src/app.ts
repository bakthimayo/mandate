import Fastify from 'fastify';
import { decisionsRoutes } from './routes/decisions.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(decisionsRoutes);

  return app;
}

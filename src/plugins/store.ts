import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Store } from '../services/store.js';

declare module 'fastify' {
  interface FastifyInstance {
    store: Store;
  }
}

// Регистрировать после db-плагина: полагается на app.pg
export default fp(async (app: FastifyInstance) => {
  app.decorate('store', new Store(app.pg));
});

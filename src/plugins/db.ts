import fp from 'fastify-plugin';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    pg: Pool;
  }
}

export default fp(async (app: FastifyInstance) => {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgres://partyloop:partyloop@localhost:5432/partyloop',
  });

  // Падаем сразу при старте, если БД недоступна, а не при первом запросе от клиента
  await pool.query('SELECT 1');

  app.decorate('pg', pool);

  app.addHook('onClose', async () => {
    await pool.end();
  });
});

import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

/**
 * Глобальный лимит запросов, хранится в Redis — работает одинаково,
 * даже если поднимем несколько инстансов API за балансировщиком.
 * Более строгие лимиты для конкретных роутов (например /auth/login)
 * задаются точечно через config.rateLimit на самом роуте.
 */
export default fp(async (app: FastifyInstance) => {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: app.redis,
    nameSpace: 'rl:',
    errorResponseBuilder: (_request, context) => ({
      error: `Слишком много запросов, попробуй снова через ${Math.ceil(context.ttl / 1000)} сек.`,
    }),
  });
});

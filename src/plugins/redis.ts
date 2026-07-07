import fp from 'fastify-plugin';
import redis from '@fastify/redis';
import type { FastifyInstance } from 'fastify';

export default fp(async (app: FastifyInstance) => {
  await app.register(redis, {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    closeClient: true,
  });

  app.redis.on('error', (err) => {
    app.log.error({ err }, 'Redis connection error');
  });
});

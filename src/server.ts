import Fastify from 'fastify';
import cors from '@fastify/cors';
import redisPlugin from './plugins/redis.js';
import rateLimitPlugin from './plugins/rateLimit.js';
import authPlugin from './plugins/auth.js';
import wsPlugin from './plugins/ws.js';
import { authRoutes } from './routes/auth.js';
import { partyRoutes } from './routes/parties.js';

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, { origin: true });
  // Redis должен быть готов до rate-limit и auth (оба на него полагаются)
  await app.register(redisPlugin);
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);
  await app.register(wsPlugin);

  await app.register(authRoutes);
  await app.register(partyRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`🎉 partyloop API запущен на http://localhost:${port}`);
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});

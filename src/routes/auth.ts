import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { store } from '../services/store.js';
import { toPublicUser } from '../types/index.js';

// Простой хэш пароля для MVP. Перед реальным продакшеном - заменить на bcrypt/argon2.
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// Более строгий лимит на auth-роуты, чтобы затруднить брутфорс паролей/спам регистраций.
const strictAuthRateLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string; displayName: string } }>(
    '/auth/register',
    { config: strictAuthRateLimit },
    async (request, reply) => {
      const { email, password, displayName } = request.body;

      if (!email || !password || !displayName) {
        return reply.code(400).send({ error: 'email, password и displayName обязательны' });
      }

      if (store.findUserByEmail(email)) {
        return reply.code(409).send({ error: 'Пользователь с таким email уже существует' });
      }

      const user = store.createUser({
        email,
        displayName,
        passwordHash: hashPassword(password),
      });

      const token = app.signUserToken(user.id);

      return reply.code(201).send({ user: toPublicUser(user), token });
    }
  );

  app.post<{ Body: { email: string; password: string } }>(
    '/auth/login',
    { config: strictAuthRateLimit },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = store.findUserByEmail(email);

      if (!user || user.passwordHash !== hashPassword(password)) {
        return reply.code(401).send({ error: 'Неверный email или пароль' });
      }

      const token = app.signUserToken(user.id);
      return reply.send({ user: toPublicUser(user), token });
    }
  );

  app.get('/auth/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const user = store.findUserById(userId);

    if (!user) {
      return reply.code(404).send({ error: 'Пользователь не найден' });
    }

    return reply.send({ user: toPublicUser(user) });
  });

  // Отзыв текущего токена: кладём jti в Redis-блэклист до истечения его срока жизни.
  app.post('/auth/logout', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { jti, exp } = request.user;
    const ttlSeconds = exp - Math.floor(Date.now() / 1000);

    if (ttlSeconds > 0) {
      await app.redis.set(`blacklist:${jti}`, '1', 'EX', ttlSeconds);
    }

    return reply.send({ ok: true });
  });
}

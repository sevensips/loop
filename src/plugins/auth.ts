import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    signUserToken: (userId: string) => string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; jti: string };
    user: { userId: string; jti: string; exp: number; iat: number };
  }
}

export default fp(async (app: FastifyInstance) => {
  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production',
  });

  // Токен с уникальным jti и сроком жизни — это то, что позволяет
  // сделать нормальный /auth/logout: без jti+exp отзывать было бы нечего.
  app.decorate('signUserToken', (userId: string) => {
    return app.jwt.sign({ userId, jti: randomUUID() }, { expiresIn: '7d' });
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ error: 'Требуется авторизация' });
    }

    const { jti } = request.user;
    const blacklisted = await app.redis.get(`blacklist:${jti}`);
    if (blacklisted) {
      return reply.code(401).send({ error: 'Токен отозван, нужно войти заново' });
    }
  });
});

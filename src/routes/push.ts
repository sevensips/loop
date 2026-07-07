import type { FastifyInstance } from 'fastify';

export async function pushRoutes(app: FastifyInstance) {
  // POST /users/me/push-token — сохранить/обновить Expo push-токен текущего устройства.
  // Вызывается с телефона сразу после получения разрешения на уведомления.
  app.post<{ Body: { token: string } }>(
    '/users/me/push-token',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { token } = request.body;

      if (!token || typeof token !== 'string') {
        return reply.code(400).send({ error: 'Поле token обязательно' });
      }

      await app.store.setPushToken(userId, token);
      return reply.send({ ok: true });
    }
  );

  // DELETE /users/me/push-token — очистить токен (вызывать при логауте,
  // чтобы разлогиненный телефон не получал чужие уведомления).
  app.delete(
    '/users/me/push-token',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      await app.store.setPushToken(userId, null);
      return reply.code(204).send();
    }
  );
}
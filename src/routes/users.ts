import type { FastifyInstance } from 'fastify';
import { toPublicUser } from '../types/index.js';

export async function userRoutes(app: FastifyInstance) {
  // PATCH /users/me — обновить свой профиль (пока только отображаемое имя).
  app.patch<{ Body: { displayName?: string } }>(
    '/users/me',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { displayName } = request.body;

      if (displayName !== undefined) {
        const trimmed = displayName.trim();
        if (trimmed.length < 2) {
          return reply.code(400).send({ error: 'Имя должно быть не короче 2 символов' });
        }
        const updated = await app.store.updateDisplayName(userId, trimmed);
        if (!updated) return reply.code(404).send({ error: 'Пользователь не найден' });
        return reply.send({ user: toPublicUser(updated) });
      }

      return reply.code(400).send({ error: 'Нечего обновлять' });
    }
  );
}
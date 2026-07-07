import type { FastifyInstance } from 'fastify';
import { toPublicUser } from '../types/index.js';
import {
  broadcastUpdatedParty,
} from '../plugins/ws.js';
import { invalidatePartiesCache } from '../services/cache.js';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB — достаточно для мобильных фото, не раздувает бакет

export async function uploadRoutes(app: FastifyInstance) {
  // POST /parties/:id/photo — загрузить/заменить обложку вечеринки (только хозяин)
  app.post<{ Params: { id: string } }>(
    '/parties/:id/photo',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const party = await app.store.findPartyById(request.params.id);

      if (!party) return reply.code(404).send({ error: 'Вечеринка не найдена' });
      if (party.hostId !== userId) {
        return reply.code(403).send({ error: 'Можно менять фото только своих вечеринок' });
      }

      const file = await request.file({ limits: { fileSize: MAX_PHOTO_BYTES } });
      if (!file) return reply.code(400).send({ error: 'Файл не передан (поле form-data "file")' });

      const buffer = await file.toBuffer();

      let photoUrl: string;
      try {
        photoUrl = await app.storage.upload(buffer, file.mimetype, `parties/${party.id}`);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }

      const updated = await app.store.setPartyPhoto(party.id, photoUrl);
      await invalidatePartiesCache(app.redis);
      if (updated) broadcastUpdatedParty(updated);

      return reply.send({ party: updated });
    }
  );

  // POST /users/me/avatar — загрузить/заменить свой аватар
  app.post(
    '/users/me/avatar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const file = await request.file({ limits: { fileSize: MAX_PHOTO_BYTES } });
      if (!file) return reply.code(400).send({ error: 'Файл не передан (поле form-data "file")' });

      const buffer = await file.toBuffer();

      let avatarUrl: string;
      try {
        avatarUrl = await app.storage.upload(buffer, file.mimetype, `avatars/${userId}`);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }

      const updated = await app.store.setUserAvatar(userId, avatarUrl);
      if (!updated) return reply.code(404).send({ error: 'Пользователь не найден' });

      return reply.send({ user: toPublicUser(updated) });
    }
  );
}

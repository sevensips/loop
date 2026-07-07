import type { FastifyInstance } from 'fastify';
import { store } from '../services/store.js';
import { broadcastNewParty } from '../plugins/ws.js';
import { getCachedParties, setCachedParties, invalidatePartiesCache } from '../services/cache.js';

interface CreatePartyBody {
  title: string;
  description: string;
  lat: number;
  lng: number;
  address?: string;
  startsAt: string;
}

interface NearQuery {
  lat: string;
  lng: string;
  radiusKm?: string;
}

export async function partyRoutes(app: FastifyInstance) {
  // Список всех вечеринок (закэширован в Redis на несколько секунд)
  app.get('/parties', async (_request, reply) => {
    const cached = await getCachedParties(app.redis, 'parties:list');
    if (cached) {
      return reply.send({ parties: cached, cached: true });
    }

    const parties = store.listParties();
    await setCachedParties(app.redis, 'parties:list', parties);
    return reply.send({ parties });
  });

  // Геопоиск: /parties/near?lat=55.75&lng=37.61&radiusKm=5
  app.get<{ Querystring: NearQuery }>('/parties/near', async (request, reply) => {
    const { lat, lng, radiusKm } = request.query;

    if (!lat || !lng) {
      return reply.code(400).send({ error: 'Параметры lat и lng обязательны' });
    }

    const radius = radiusKm ? parseFloat(radiusKm) : 5;
    const cacheKey = `parties:near:${lat}:${lng}:${radius}`;

    const cached = await getCachedParties(app.redis, cacheKey);
    if (cached) {
      return reply.send({ parties: cached, cached: true });
    }

    const parties = store.findPartiesNear(parseFloat(lat), parseFloat(lng), radius);
    await setCachedParties(app.redis, cacheKey, parties);
    return reply.send({ parties });
  });

  app.get<{ Params: { id: string } }>('/parties/:id', async (request, reply) => {
    const party = store.findPartyById(request.params.id);
    if (!party) {
      return reply.code(404).send({ error: 'Вечеринка не найдена' });
    }
    return reply.send({ party });
  });

  // Создание вечеринки - требует авторизации
  app.post<{ Body: CreatePartyBody }>(
    '/parties',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { title, description, lat, lng, address, startsAt } = request.body;

      if (!title || lat === undefined || lng === undefined || !startsAt) {
        return reply
          .code(400)
          .send({ error: 'title, lat, lng и startsAt обязательны' });
      }

      const party = store.createParty({
        hostId: userId,
        title,
        description: description ?? '',
        lat,
        lng,
        address,
        startsAt,
      });

      await invalidatePartiesCache(app.redis);

      // Уведомляем всех подключённых по WebSocket о новой вечеринке
      broadcastNewParty(party);

      return reply.code(201).send({ party });
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/parties/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const party = store.findPartyById(request.params.id);

      if (!party) {
        return reply.code(404).send({ error: 'Вечеринка не найдена' });
      }

      if (party.hostId !== userId) {
        return reply.code(403).send({ error: 'Можно удалять только свои вечеринки' });
      }

      store.deleteParty(request.params.id);
      await invalidatePartiesCache(app.redis);

      return reply.code(204).send();
    }
  );
}

import type { FastifyInstance } from 'fastify';
import {
  broadcastNewParty,
  broadcastUpdatedParty,
  broadcastDeletedParty,
} from '../plugins/ws.js';
import {
  getCachedParties,
  setCachedParties,
  invalidatePartiesCache,
} from '../services/cache.js';

// ---- JSON Schema ----

const partyBody = {
  type: 'object',
  required: ['title', 'lat', 'lng', 'startsAt'],
  properties: {
    title:       { type: 'string', minLength: 1, maxLength: 120 },
    description: { type: 'string', maxLength: 2000 },
    address:     { type: 'string', maxLength: 300 },
    lat:         { type: 'number', minimum: -90,  maximum: 90  },
    lng:         { type: 'number', minimum: -180, maximum: 180 },
    startsAt:    { type: 'string', format: 'date-time' },
  },
} as const;

const patchPartyBody = {
  type: 'object',
  minProperties: 1,
  properties: {
    title:       { type: 'string', minLength: 1, maxLength: 120 },
    description: { type: 'string', maxLength: 2000 },
    address:     { type: 'string', maxLength: 300 },
    lat:         { type: 'number', minimum: -90,  maximum: 90  },
    lng:         { type: 'number', minimum: -180, maximum: 180 },
    startsAt:    { type: 'string', format: 'date-time' },
  },
} as const;

const nearQuery = {
  type: 'object',
  required: ['lat', 'lng'],
  properties: {
    lat:      { type: 'string' },
    lng:      { type: 'string' },
    radiusKm: { type: 'string' },
  },
} as const;

// ---- Route interfaces ----

interface CreatePartyBody {
  title: string;
  description?: string;
  lat: number;
  lng: number;
  address?: string;
  startsAt: string;
}

interface PatchPartyBody {
  title?: string;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  startsAt?: string;
}

interface NearQuery {
  lat: string;
  lng: string;
  radiusKm?: string;
}

// ---- Routes ----

export async function partyRoutes(app: FastifyInstance) {

  // GET /parties — список всех (с Redis-кэшем)
  app.get('/parties', async (_req, reply) => {
    const cached = await getCachedParties(app.redis, 'parties:list');
    if (cached) return reply.send({ parties: cached, cached: true });

    const parties = await app.store.listParties();
    await setCachedParties(app.redis, 'parties:list', parties);
    return reply.send({ parties });
  });

  // GET /parties/near?lat=&lng=&radiusKm=
  app.get<{ Querystring: NearQuery }>(
    '/parties/near',
    { schema: { querystring: nearQuery } },
    async (request, reply) => {
      const { lat, lng, radiusKm } = request.query;
      const radius = radiusKm ? parseFloat(radiusKm) : 5;
      const cacheKey = `parties:near:${lat}:${lng}:${radius}`;

      const cached = await getCachedParties(app.redis, cacheKey);
      if (cached) return reply.send({ parties: cached, cached: true });

      const parties = await app.store.findPartiesNear(parseFloat(lat), parseFloat(lng), radius);
      await setCachedParties(app.redis, cacheKey, parties);
      return reply.send({ parties });
    }
  );

  // GET /parties/:id
  app.get<{ Params: { id: string } }>('/parties/:id', async (request, reply) => {
    const party = await app.store.findPartyById(request.params.id);
    if (!party) return reply.code(404).send({ error: 'Вечеринка не найдена' });
    return reply.send({ party });
  });

  // POST /parties — создать (требует auth)
  app.post<{ Body: CreatePartyBody }>(
    '/parties',
    { onRequest: [app.authenticate], schema: { body: partyBody } },
    async (request, reply) => {
      const { userId } = request.user;
      const { title, description, lat, lng, address, startsAt } = request.body;

      const party = await app.store.createParty({
        hostId: userId,
        title,
        description: description ?? '',
        lat,
        lng,
        address,
        startsAt,
      });

      await invalidatePartiesCache(app.redis);
      broadcastNewParty(party);

      return reply.code(201).send({ party });
    }
  );

  // PATCH /parties/:id — редактировать (только хозяин)
  app.patch<{ Params: { id: string }; Body: PatchPartyBody }>(
    '/parties/:id',
    { onRequest: [app.authenticate], schema: { body: patchPartyBody } },
    async (request, reply) => {
      const { userId } = request.user;
      const party = await app.store.findPartyById(request.params.id);

      if (!party) return reply.code(404).send({ error: 'Вечеринка не найдена' });
      if (party.hostId !== userId) return reply.code(403).send({ error: 'Можно редактировать только свои вечеринки' });

      const updated = await app.store.updateParty(request.params.id, request.body);
      if (!updated) return reply.code(404).send({ error: 'Вечеринка не найдена' });

      await invalidatePartiesCache(app.redis);
      broadcastUpdatedParty(updated);

      return reply.send({ party: updated });
    }
  );

  // DELETE /parties/:id — удалить (только хозяин)
  app.delete<{ Params: { id: string } }>(
    '/parties/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const party = await app.store.findPartyById(request.params.id);

      if (!party) return reply.code(404).send({ error: 'Вечеринка не найдена' });
      if (party.hostId !== userId) return reply.code(403).send({ error: 'Можно удалять только свои вечеринки' });

      await app.store.deleteParty(request.params.id);
      await invalidatePartiesCache(app.redis);
      broadcastDeletedParty(request.params.id);

      return reply.code(204).send();
    }
  );

  // POST /parties/:id/join — записаться
  app.post<{ Params: { id: string } }>(
    '/parties/:id/join',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const party = await app.store.findPartyById(request.params.id);

      if (!party) return reply.code(404).send({ error: 'Вечеринка не найдена' });
      if (party.hostId === userId) return reply.code(400).send({ error: 'Хозяин не может записаться к себе' });

      const alreadyMember = await app.store.isPartyMember(request.params.id, userId);
      if (alreadyMember) return reply.code(409).send({ error: 'Вы уже записаны на эту вечеринку' });

      await app.store.joinParty(request.params.id, userId);
      await invalidatePartiesCache(app.redis);

      // Получаем обновлённую вечеринку с новым memberCount для WS-рассылки
      const updated = await app.store.findPartyById(request.params.id);
      if (updated) broadcastUpdatedParty(updated);

      return reply.code(201).send({ ok: true });
    }
  );

  // DELETE /parties/:id/join — отписаться
  app.delete<{ Params: { id: string } }>(
    '/parties/:id/join',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const party = await app.store.findPartyById(request.params.id);

      if (!party) return reply.code(404).send({ error: 'Вечеринка не найдена' });

      const wasMember = await app.store.leaveParty(request.params.id, userId);
      if (!wasMember) return reply.code(404).send({ error: 'Вы не записаны на эту вечеринку' });

      await invalidatePartiesCache(app.redis);
      const updated = await app.store.findPartyById(request.params.id);
      if (updated) broadcastUpdatedParty(updated);

      return reply.code(204).send();
    }
  );

  // GET /parties/:id/members — список участников
  app.get<{ Params: { id: string } }>(
    '/parties/:id/members',
    async (request, reply) => {
      const party = await app.store.findPartyById(request.params.id);
      if (!party) return reply.code(404).send({ error: 'Вечеринка не найдена' });

      const members = await app.store.listPartyMembers(request.params.id);
      return reply.send({ members });
    }
  );
}

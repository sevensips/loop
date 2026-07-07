import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import type { Party } from '../types/index.js';
import type { WebSocket } from 'ws';

const clients: Set<WebSocket> = new Set();

function broadcast(type: string, payload: unknown) {
  const message = JSON.stringify({ type, payload });
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

export function broadcastNewParty(party: Party)     { broadcast('party:new',     party); }
export function broadcastUpdatedParty(party: Party) { broadcast('party:updated', party); }
export function broadcastDeletedParty(id: string)   { broadcast('party:deleted', { id }); }

export default fp(async (app: FastifyInstance) => {
  app.register(websocket);

  app.register(async (app) => {
    app.get('/ws', { websocket: true }, (socket) => {
      clients.add(socket);
      socket.on('close', () => clients.delete(socket));
      socket.send(JSON.stringify({ type: 'connected', payload: { clientsOnline: clients.size } }));
    });
  });
});

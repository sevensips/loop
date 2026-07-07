import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import type { Party } from '../types/index.js';
import type { WebSocket } from 'ws';

const clients: Set<WebSocket> = new Set();

export function broadcastNewParty(party: Party) {
  const message = JSON.stringify({ type: 'party:new', payload: party });
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

export default fp(async (app: FastifyInstance) => {
  app.register(websocket);

  app.register(async (app) => {
    app.get('/ws', { websocket: true }, (socket) => {
      clients.add(socket);

      socket.on('close', () => {
        clients.delete(socket);
      });

      socket.send(JSON.stringify({ type: 'connected' }));
    });
  });
});

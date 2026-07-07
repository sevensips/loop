import type { Redis } from 'ioredis';
import type { Party } from '../types/index.js';

// Короткий TTL: список вечеринок не должен "залипать" надолго,
// но частые /parties и /parties/near не должны каждый раз бить в store.
const TTL_SECONDS = 10;

export async function getCachedParties(redis: Redis, key: string): Promise<Party[] | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as Party[]) : null;
}

export async function setCachedParties(redis: Redis, key: string, parties: Party[]): Promise<void> {
  await redis.set(key, JSON.stringify(parties), 'EX', TTL_SECONDS);
}

// Простая инвалидация по префиксу через KEYS — нормально для MVP-объёмов.
// На большом инстансе Redis стоит заменить на SCAN, чтобы не блокировать сервер.
export async function invalidatePartiesCache(redis: Redis): Promise<void> {
  const keys = await redis.keys('parties:*');
  if (keys.length) {
    await redis.del(...keys);
  }
}

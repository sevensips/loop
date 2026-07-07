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

// Инвалидация по префиксу через SCAN — не блокирует Redis на больших объёмах ключей,
// в отличие от KEYS, которая сканирует всё одним синхронным проходом.
export async function invalidatePartiesCache(redis: Redis): Promise<void> {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'parties:*', 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}

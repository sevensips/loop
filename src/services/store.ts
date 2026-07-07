import { randomUUID } from 'node:crypto';
import type { User, Party } from '../types/index.js';

/**
 * In-memory реализация хранилища.
 * Когда подключим Postgres — заменим тело методов на SQL-запросы,
 * а интерфейс (сигнатуры методов) оставим тем же самым,
 * чтобы роуты вообще не менялись.
 */
class Store {
  private users: Map<string, User> = new Map();
  private parties: Map<string, Party> = new Map();

  // ---- Users ----
  createUser(data: Omit<User, 'id' | 'createdAt'>): User {
    const user: User = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  findUserByEmail(email: string): User | undefined {
    return [...this.users.values()].find((u) => u.email === email);
  }

  findUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  // ---- Parties ----
  createParty(data: Omit<Party, 'id' | 'createdAt'>): Party {
    const party: Party = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.parties.set(party.id, party);
    return party;
  }

  listParties(): Party[] {
    return [...this.parties.values()].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  }

  findPartyById(id: string): Party | undefined {
    return this.parties.get(id);
  }

  deleteParty(id: string): boolean {
    return this.parties.delete(id);
  }

  /**
   * Геопоиск по формуле гаверсинуса (в километрах).
   * Когда будет Postgres+PostGIS — заменим на ST_DWithin, будет быстрее на больших объёмах,
   * но пока для MVP это абсолютно нормально.
   */
  findPartiesNear(lat: number, lng: number, radiusKm: number): Party[] {
    return this.listParties().filter((p) => {
      const distance = haversineKm(lat, lng, p.lat, p.lng);
      return distance <= radiusKm;
    });
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export const store = new Store();

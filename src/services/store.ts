import type { Pool } from 'pg';
import type { User, Party } from '../types/index.js';

/**
 * Postgres/PostGIS реализация хранилища.
 * Сигнатуры методов те же, что были у in-memory версии — роуты не менялись
 * почти никак, кроме добавления await (методы стали асинхронными).
 */
export class Store {
  constructor(private pool: Pool) {}

  // ---- Users ----
  async createUser(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, password_hash, created_at`,
      [data.email, data.displayName, data.passwordHash]
    );
    return rowToUser(rows[0]);
  }

  async findUserByEmail(email: string): Promise<User | undefined> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, display_name, password_hash, created_at
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async findUserById(id: string): Promise<User | undefined> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, display_name, password_hash, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  // ---- Parties ----
  async createParty(data: Omit<Party, 'id' | 'createdAt'>): Promise<Party> {
    const { rows } = await this.pool.query<PartyRow>(
      `INSERT INTO parties (host_id, title, description, address, starts_at, location)
       VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography)
       RETURNING id, host_id, title, description, address, starts_at, created_at,
                 ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`,
      [data.hostId, data.title, data.description, data.address ?? null, data.startsAt, data.lng, data.lat]
    );
    return rowToParty(rows[0]);
  }

  async listParties(): Promise<Party[]> {
    const { rows } = await this.pool.query<PartyRow>(
      `SELECT id, host_id, title, description, address, starts_at, created_at,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM parties
       ORDER BY starts_at ASC`
    );
    return rows.map(rowToParty);
  }

  async findPartyById(id: string): Promise<Party | undefined> {
    const { rows } = await this.pool.query<PartyRow>(
      `SELECT id, host_id, title, description, address, starts_at, created_at,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM parties WHERE id = $1`,
      [id]
    );
    return rows[0] ? rowToParty(rows[0]) : undefined;
  }

  async deleteParty(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM parties WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Геопоиск через ST_DWithin на geography-колонке с GIST-индексом.
   * Расстояние в PostGIS geography считается в метрах, поэтому radiusKm * 1000.
   */
  async findPartiesNear(lat: number, lng: number, radiusKm: number): Promise<Party[]> {
    const { rows } = await this.pool.query<PartyRow>(
      `SELECT id, host_id, title, description, address, starts_at, created_at,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM parties
       WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       ORDER BY starts_at ASC`,
      [lng, lat, radiusKm * 1000]
    );
    return rows.map(rowToParty);
  }
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
}

interface PartyRow {
  id: string;
  host_id: string;
  title: string;
  description: string;
  address: string | null;
  starts_at: string;
  created_at: string;
  lat: number;
  lng: number;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function rowToParty(row: PartyRow): Party {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    description: row.description,
    address: row.address ?? undefined,
    startsAt: row.starts_at,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at,
  };
}

import type { Pool } from 'pg';
import type { User, Party } from '../types/index.js';

export class Store {
  constructor(private pool: Pool) {}

  // ---- Users ----
  async createUser(data: Omit<User, 'id' | 'createdAt' | 'avatarUrl'>): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, password_hash, avatar_url, created_at`,
      [data.email, data.displayName, data.passwordHash]
    );
    return rowToUser(rows[0]);
  }

  async findUserByEmail(email: string): Promise<User | undefined> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, display_name, password_hash, avatar_url, created_at
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async findUserById(id: string): Promise<User | undefined> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, display_name, password_hash, avatar_url, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async setUserAvatar(id: string, avatarUrl: string): Promise<User | undefined> {
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE users SET avatar_url = $1 WHERE id = $2
       RETURNING id, email, display_name, password_hash, avatar_url, created_at`,
      [avatarUrl, id]
    );
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  // ---- Parties ----
  async createParty(data: Omit<Party, 'id' | 'createdAt' | 'memberCount' | 'photoUrl'>): Promise<Party> {
    const { rows } = await this.pool.query<PartyRow>(
      `INSERT INTO parties (host_id, title, description, address, starts_at, location)
       VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography)
       RETURNING id, host_id, title, description, address, starts_at, photo_url, created_at,
                 ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, 0 AS member_count`,
      [data.hostId, data.title, data.description, data.address ?? null, data.startsAt, data.lng, data.lat]
    );
    return rowToParty(rows[0]);
  }

  async listParties(): Promise<Party[]> {
    const { rows } = await this.pool.query<PartyRow>(
      `SELECT p.id, p.host_id, p.title, p.description, p.address, p.starts_at, p.photo_url, p.created_at,
              ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
              COUNT(pm.user_id) AS member_count
       FROM parties p
       LEFT JOIN party_members pm ON pm.party_id = p.id
       GROUP BY p.id
       ORDER BY p.starts_at ASC`
    );
    return rows.map(rowToParty);
  }

  async findPartyById(id: string): Promise<Party | undefined> {
    const { rows } = await this.pool.query<PartyRow>(
      `SELECT p.id, p.host_id, p.title, p.description, p.address, p.starts_at, p.photo_url, p.created_at,
              ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
              COUNT(pm.user_id) AS member_count
       FROM parties p
       LEFT JOIN party_members pm ON pm.party_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );
    return rows[0] ? rowToParty(rows[0]) : undefined;
  }

  async setPartyPhoto(id: string, photoUrl: string): Promise<Party | undefined> {
    await this.pool.query('UPDATE parties SET photo_url = $1 WHERE id = $2', [photoUrl, id]);
    return this.findPartyById(id);
  }

  async updateParty(
    id: string,
    data: Partial<Pick<Party, 'title' | 'description' | 'address' | 'startsAt' | 'lat' | 'lng'>>
  ): Promise<Party | undefined> {
    // Собираем только переданные поля динамически
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined)       { sets.push(`title = $${idx++}`);       values.push(data.title); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); values.push(data.description); }
    if (data.address !== undefined)     { sets.push(`address = $${idx++}`);     values.push(data.address); }
    if (data.startsAt !== undefined)    { sets.push(`starts_at = $${idx++}`);   values.push(data.startsAt); }

    // Если переданы координаты — обновляем geography сразу
    if (data.lat !== undefined && data.lng !== undefined) {
      sets.push(`location = ST_SetSRID(ST_MakePoint($${idx++}, $${idx++}), 4326)::geography`);
      values.push(data.lng, data.lat);
    }

    if (sets.length === 0) return this.findPartyById(id);

    values.push(id);
    const { rows } = await this.pool.query<PartyRow>(
      `UPDATE parties SET ${sets.join(', ')}
       WHERE id = $${idx}
       RETURNING id, host_id, title, description, address, starts_at, photo_url, created_at,
                 ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, 0 AS member_count`,
      values
    );
    return rows[0] ? rowToParty(rows[0]) : undefined;
  }

  async deleteParty(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM parties WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findPartiesNear(lat: number, lng: number, radiusKm: number): Promise<Party[]> {
    const { rows } = await this.pool.query<PartyRow>(
      `SELECT p.id, p.host_id, p.title, p.description, p.address, p.starts_at, p.photo_url, p.created_at,
              ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
              COUNT(pm.user_id) AS member_count
       FROM parties p
       LEFT JOIN party_members pm ON pm.party_id = p.id
       WHERE ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       GROUP BY p.id
       ORDER BY p.starts_at ASC`,
      [lng, lat, radiusKm * 1000]
    );
    return rows.map(rowToParty);
  }

  // ---- Members ----
  async joinParty(partyId: string, userId: string): Promise<boolean> {
    try {
      await this.pool.query(
        `INSERT INTO party_members (party_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [partyId, userId]
      );
      return true;
    } catch {
      return false;
    }
  }

  async leaveParty(partyId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM party_members WHERE party_id = $1 AND user_id = $2`,
      [partyId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async isPartyMember(partyId: string, userId: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      `SELECT 1 FROM party_members WHERE party_id = $1 AND user_id = $2`,
      [partyId, userId]
    );
    return rows.length > 0;
  }

  async listPartyMembers(partyId: string): Promise<PublicUserRow[]> {
    const { rows } = await this.pool.query<PublicUserRow>(
      `SELECT u.id, u.email, u.display_name, pm.joined_at
       FROM party_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.party_id = $1
       ORDER BY pm.joined_at ASC`,
      [partyId]
    );
    return rows;
  }
}

// ---- Row types & mappers ----

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  avatar_url: string | null;
  created_at: string;
}

interface PartyRow {
  id: string;
  host_id: string;
  title: string;
  description: string;
  address: string | null;
  starts_at: string;
  photo_url: string | null;
  created_at: string;
  lat: number;
  lng: number;
  member_count: string; // pg возвращает COUNT как строку
}

interface PublicUserRow {
  id: string;
  email: string;
  display_name: string;
  joined_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    avatarUrl: row.avatar_url ?? undefined,
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
    photoUrl: row.photo_url ?? undefined,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at,
    memberCount: Number(row.member_count),
  };
}

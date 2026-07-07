import { API_URL } from '../config';
import type { Party, PartyMember, PublicUser } from '../types';

let authToken: string | null = null;

/** Вызывается из AuthContext при логине/логауте/restore из AsyncStorage */
export function setAuthToken(token: string | null) {
  authToken = token;
}

class ApiRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiRequestError(data.error ?? `Ошибка запроса (${res.status})`, res.status);
  }
  return data as T;
}

/** Мультипарт-загрузка файла (фото вечеринки / аватар) */
async function uploadFile<T>(
  path: string,
  file: { uri: string; name: string; type: string }
): Promise<T> {
  const form = new FormData();
  // @ts-expect-error — RN-специфичный формат объекта файла для FormData
  form.append('file', { uri: file.uri, name: file.name, type: file.type });

  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiRequestError(data.error ?? `Ошибка загрузки (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  // ---- Auth ----
  register: (email: string, password: string, displayName: string) =>
    request<{ user: PublicUser; token: string }>('/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
      auth: false,
    }),

  login: (email: string, password: string) =>
    request<{ user: PublicUser; token: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),

  me: () => request<{ user: PublicUser }>('/auth/me'),

  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  
  updateProfile: (displayName: string) =>
  request<{ user: PublicUser }>('/users/me', { method: 'PATCH', body: { displayName } }),
  
  // ---- Parties ----
  listParties: () => request<{ parties: Party[]; cached?: boolean }>('/parties', { auth: false }),

  findPartiesNear: (lat: number, lng: number, radiusKm = 5) =>
    request<{ parties: Party[]; cached?: boolean }>(
      `/parties/near?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`,
      { auth: false }
    ),

  getParty: (id: string) => request<{ party: Party }>(`/parties/${id}`, { auth: false }),

  createParty: (data: {
    title: string;
    description?: string;
    address?: string;
    lat: number;
    lng: number;
    startsAt: string;
  }) => request<{ party: Party }>('/parties', { method: 'POST', body: data }),

  updateParty: (id: string, data: Partial<Party>) =>
    request<{ party: Party }>(`/parties/${id}`, { method: 'PATCH', body: data }),

  deleteParty: (id: string) => request<void>(`/parties/${id}`, { method: 'DELETE' }),

  joinParty: (id: string) => request<{ ok: true }>(`/parties/${id}/join`, { method: 'POST' }),

  leaveParty: (id: string) => request<void>(`/parties/${id}/join`, { method: 'DELETE' }),

  listMembers: (id: string) =>
    request<{ members: PartyMember[] }>(`/parties/${id}/members`, { auth: false }),

  uploadPartyPhoto: (partyId: string, file: { uri: string; name: string; type: string }) =>
    uploadFile<{ party: Party }>(`/parties/${partyId}/photo`, file),

  uploadAvatar: (file: { uri: string; name: string; type: string }) =>
    uploadFile<{ user: PublicUser }>('/users/me/avatar', file),
};

export { ApiRequestError };

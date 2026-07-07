export interface User {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  avatarUrl?: string;
}

export interface Party {
  id: string;
  hostId: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  address?: string;
  startsAt: string;
  createdAt: string;
  memberCount?: number;
  photoUrl?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...rest } = user;
  return rest;
}

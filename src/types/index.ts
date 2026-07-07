export interface User {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string; // упростим пока - потом заменим на OAuth/JWT-полный флоу
  createdAt: string;
}

export interface Party {
  id: string;
  hostId: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  address?: string;
  startsAt: string; // ISO string
  createdAt: string;
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

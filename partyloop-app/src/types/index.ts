export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
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
  photoUrl?: string;
  createdAt: string;
  memberCount?: number;
}

export interface PartyMember {
  id: string;
  email: string;
  display_name: string;
  joined_at: string;
}

export interface ApiError {
  error: string;
}

export interface DiscoverCandidate {
  userId: string;
  displayName: string;
  age: number;
  gender: string;
  bio: string | null;
  interests: string[];
  city: string | null;
  distanceKm: number; // Rounded to nearest 5 km (e.g. 5, 10, 15...)
  photos: Array<{
    id: string;
    url: string;
    position: number;
  }>;
}

export type SwipeAction = 'like' | 'pass';

export interface SwipeRequest {
  targetUserId: string;
  action: SwipeAction;
}

export interface SwipeResponse {
  match: boolean;
  matchId?: string;
  matchedUser?: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
}

export interface MatchPartner {
  id: string;
  displayName: string;
  age: number;
  gender: string;
  city: string | null;
  avatar: string | null;
  bio: string | null;
  lastActiveAt: string;
}

export interface MatchItem {
  id: string;
  partner: MatchPartner;
  createdAt: string;
  lastMessage?: {
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
}

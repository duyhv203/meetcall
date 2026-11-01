export type UserStatus = 'active' | 'suspended' | 'deleted';

export type UserRole = 'user' | 'admin';

export type Gender = 'male' | 'female' | 'other';

export type PhotoModerationStatus = 'pending' | 'approved' | 'rejected';

export type SwipeDirection = 'like' | 'pass';

export type CallKind = 'match' | 'random';

export type CallEndReason =
  | 'completed'
  | 'declined'
  | 'missed'
  | 'cancelled'
  | 'failed'
  | 'skipped';

export type ReportReason = 'nudity' | 'harassment' | 'minor' | 'scam' | 'spam' | 'other';

export type ReportStatus = 'open' | 'reviewed' | 'actioned';

export type AdminActionType = 'dismiss' | 'warn' | 'suspend' | 'ban';

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  status: 'ok';
  timestamp?: string;
  services?: {
    postgres: boolean;
    redis: boolean;
  };
}

export interface Coordinates {
  lat: number;
  lng: number;
}

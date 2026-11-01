import type { AuthUser } from './auth.dto.js';
import type { PhotoModerationStatus } from './types.js';

export interface ProfileData {
  userId: string;
  displayName: string;
  birthdate: string;
  gender: string;
  bio: string | null;
  interests: string[];
  city: string | null;
  lastActiveAt: string;
}

export interface PreferencesData {
  userId: string;
  genderFilter: string[];
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
}

export interface PhotoData {
  id: string;
  userId: string;
  url: string;
  position: number;
  moderationStatus: PhotoModerationStatus;
  createdAt: string;
}

export interface MeResponse {
  user: AuthUser;
  profile: ProfileData;
  preferences: PreferencesData | null;
  photos: PhotoData[];
  onboardingCompleted: boolean;
}

export interface UpdateProfileRequest {
  displayName?: string;
  gender?: string;
  bio?: string;
  interests?: string[];
  city?: string;
}

export interface UpdatePreferencesRequest {
  genderFilter: string[];
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
}

export interface UpdateLocationRequest {
  lat: number;
  lng: number;
  city?: string;
}

export interface GetUploadUrlRequest {
  contentType: string;
  size: number;
}

export interface GetUploadUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface ConfirmPhotoRequest {
  key: string;
}

export interface ReorderPhotosRequest {
  ids: string[];
}

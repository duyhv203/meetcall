export interface RegisterDeviceRequest {
  fcmToken: string;
  platform: 'web' | 'ios' | 'android';
}

export interface UnregisterDeviceRequest {
  fcmToken: string;
}

export interface ExportDataResponse {
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
    ageVerified: boolean;
    createdAt: string;
  };
  profile: {
    displayName: string;
    birthdate: string;
    gender: string;
    bio?: string | null;
    interests?: string[];
    city?: string | null;
  } | null;
  preferences: {
    minAge: number;
    maxAge: number;
    maxDistanceKm: number;
    genderFilter: string[];
  } | null;
  photos: Array<{
    id: string;
    url: string;
    position: number;
    moderationStatus: string;
    createdAt: string;
  }>;
  matchesCount: number;
  messagesSentCount: number;
  callsCount: number;
  blocksCount: number;
  exportedAt: string;
}

export interface DeleteAccountRequest {
  reason?: string;
  password?: string;
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
  scheduledPermanentDeleteAt: string;
}

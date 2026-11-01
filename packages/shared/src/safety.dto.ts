export type ReportReasonType = 'nudity' | 'harassment' | 'minor' | 'scam' | 'spam' | 'other';
export type ReportStatusType = 'open' | 'reviewed' | 'actioned';
export type AdminActionTypeEnum = 'dismiss' | 'warn' | 'suspend' | 'ban';

export interface CreateBlockRequest {
  blockedId: string;
}

export interface BlockItemResponse {
  id: string;
  blockedId: string;
  blockedUser: {
    displayName: string;
    photoUrl?: string | null;
  };
  createdAt: string;
}

export interface CreateReportRequest {
  targetId: string;
  reason: ReportReasonType;
  details?: string;
  callId?: string;
}

export interface CreateReportResponse {
  id: string;
  message: string;
  autoBannedRandom?: boolean;
}

export interface AdminReportItem {
  id: string;
  reporterId: string;
  targetId: string;
  callId?: string | null;
  reason: ReportReasonType;
  priority: 'urgent' | 'normal';
  status: ReportStatusType;
  details?: string | null;
  createdAt: string;
  reporter: {
    id: string;
    email: string;
    displayName: string;
  };
  target: {
    id: string;
    email: string;
    displayName: string;
    status: string;
    randomBannedUntil?: string | null;
  };
}

export interface ResolveReportRequest {
  action: AdminActionTypeEnum;
  note?: string;
}

export interface SuspendUserRequest {
  suspend: boolean;
  note?: string;
}

export interface ModeratePhotoRequest {
  status: 'approved' | 'rejected';
}

export interface AgeVerificationWebhookPayload {
  userId: string;
  verified: boolean;
  birthdate?: string;
  referenceId?: string;
}

export interface AdminStatsResponse {
  users: {
    total: number;
    active: number;
    suspended: number;
    ageVerified: number;
    admins: number;
  };
  activity: {
    totalMatches: number;
    totalMessages: number;
    totalCalls: number;
    completedCalls: number;
  };
  safety: {
    totalReports: number;
    openReports: number;
    urgentReports: number;
    pendingPhotos: number;
    totalPhotos: number;
  };
  system: {
    postgres: 'healthy' | 'error';
    redis: 'healthy' | 'error';
    uptimeSeconds: number;
  };
}

export interface AdminUserItem {
  id: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  ageVerified: boolean;
  randomBannedUntil?: string | null;
  createdAt: string;
  profile?: {
    displayName: string;
    gender: string;
    birthdate: string;
    city?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    photoCount: number;
  } | null;
  photos?: Array<{
    id: string;
    url: string;
    position: number;
    moderationStatus: string;
  }>;
  stats?: {
    matchesCount: number;
    swipesUsed: number;
    swipesPurchased: number;
    reportsCount: number;
  };
}

export interface AdminActionLogItem {
  id: string;
  adminId: string;
  adminEmail: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  reportId?: string | null;
  action: string;
  note?: string | null;
  createdAt: string;
}

export interface UpdateUserRoleRequest {
  role: 'user' | 'admin';
}

export interface VerifyUserAgeRequest {
  ageVerified: boolean;
}


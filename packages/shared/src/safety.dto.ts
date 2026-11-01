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

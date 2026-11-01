export interface RtcIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServersResponse {
  iceServers: RtcIceServer[];
  ttl: number;
}

export interface InitiateCallRequest {
  matchId: string;
}

export interface InitiateCallResponse {
  callId: string;
  calleeId: string;
}

export interface EndCallRequest {
  reason?: 'completed' | 'declined' | 'missed' | 'cancelled' | 'failed' | 'skipped';
}

export interface CallIncomingPayload {
  callId: string;
  caller: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
  matchId?: string;
}

export interface RtcSignalPayload {
  callId: string;
  targetUserId: string;
  signal: unknown;
}

export interface RandomJoinPayload {
  preferredGender?: string;
}

export interface RandomPairedPartner {
  id: string;
  displayName: string;
  gender: string;
  age: number;
}

export interface RandomPairedPayload {
  callId: string;
  partner: RandomPairedPartner;
  initiator: boolean;
}

export interface FriendVoteRequest {
  wantsFriend: boolean;
}

export interface FriendVoteResponse {
  matchCreated: boolean;
  matchId?: string;
}

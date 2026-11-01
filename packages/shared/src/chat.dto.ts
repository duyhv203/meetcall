export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface MessagesResponse {
  items: ChatMessage[];
  nextCursor: string | null;
}

export interface SendMessageRequest {
  content: string;
}

export interface ChatTypingPayload {
  matchId: string;
  isTyping: boolean;
}

export interface UserPresenceResponse {
  userId: string;
  isOnline: boolean;
  lastActiveAt?: string;
}

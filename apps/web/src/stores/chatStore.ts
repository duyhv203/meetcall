import { create } from 'zustand';
import type { ChatMessage, MessagesResponse } from '@meetcall/shared';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

interface ChatState {
  activeMatchId: string | null;
  messages: ChatMessage[];
  nextCursor: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  isPartnerTyping: boolean;
  isPartnerOnline: boolean;
  error: string | null;

  setActiveMatch: (matchId: string, partnerId?: string) => void;
  fetchInitialMessages: (matchId: string) => Promise<void>;
  fetchMoreMessages: () => Promise<void>;
  sendMessage: (content: string) => Promise<boolean>;
  sendTyping: (isTyping: boolean) => void;
  markAsRead: () => Promise<void>;
  checkPartnerPresence: (partnerId: string) => Promise<void>;

  // Event handlers
  onMessageReceived: (message: ChatMessage) => void;
  onTypingReceived: (data: { matchId: string; userId: string; isTyping: boolean }) => void;
  onReadReceived: (data: { matchId: string; readBy: string; readAt: string }) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeMatchId: null,
  messages: [],
  nextCursor: null,
  isLoading: false,
  isLoadingMore: false,
  isPartnerTyping: false,
  isPartnerOnline: false,
  error: null,

  resetChat: () =>
    set({
      activeMatchId: null,
      messages: [],
      nextCursor: null,
      isLoading: false,
      isLoadingMore: false,
      isPartnerTyping: false,
      isPartnerOnline: false,
      error: null,
    }),

  setActiveMatch: (matchId: string) => {
    set({ activeMatchId: matchId, messages: [], nextCursor: null, error: null });
  },

  fetchInitialMessages: async (matchId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api<MessagesResponse>(`/matches/${matchId}/messages?limit=30`);
      // Reverse so items are in chronological order (oldest to newest)
      const sorted = [...res.items].reverse();
      set({
        messages: sorted,
        nextCursor: res.nextCursor,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Không thể tải tin nhắn',
        isLoading: false,
      });
    }
  },

  fetchMoreMessages: async () => {
    const { activeMatchId, nextCursor, isLoadingMore, messages } = get();
    if (!activeMatchId || !nextCursor || isLoadingMore) return;

    set({ isLoadingMore: true });
    try {
      const res = await api<MessagesResponse>(
        `/matches/${activeMatchId}/messages?limit=30&cursor=${encodeURIComponent(nextCursor)}`,
      );
      const olderMessages = [...res.items].reverse();
      set({
        messages: [...olderMessages, ...messages],
        nextCursor: res.nextCursor,
        isLoadingMore: false,
      });
    } catch {
      set({ isLoadingMore: false });
    }
  },

  sendMessage: async (content: string) => {
    const { activeMatchId } = get();
    if (!activeMatchId || !content.trim()) return false;

    try {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('chat:send', {
          matchId: activeMatchId,
          content: content.trim(),
        });
      } else {
        await api<ChatMessage>(`/matches/${activeMatchId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: content.trim() }),
        });
      }
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Gửi tin nhắn thất bại',
      });
      return false;
    }
  },

  sendTyping: (isTyping: boolean) => {
    const { activeMatchId } = get();
    if (!activeMatchId) return;
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:typing', { matchId: activeMatchId, isTyping });
    }
  },

  markAsRead: async () => {
    const { activeMatchId } = get();
    if (!activeMatchId) return;
    try {
      await api<{ success: boolean }>(`/matches/${activeMatchId}/read`, {
        method: 'POST',
      });
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('chat:read', { matchId: activeMatchId });
      }
    } catch {
      // Ignore background read receipt errors
    }
  },

  checkPartnerPresence: async (partnerId: string) => {
    try {
      const res = await api<{ userId: string; isOnline: boolean }>(
        `/users/${partnerId}/presence`,
      );
      set({ isPartnerOnline: res.isOnline });
    } catch {
      set({ isPartnerOnline: false });
    }
  },

  onMessageReceived: (message: ChatMessage) => {
    const { activeMatchId, messages } = get();
    if (activeMatchId !== message.matchId) return;

    // Check duplicate
    if (messages.some((m) => m.id === message.id)) return;

    set({ messages: [...messages, message] });
  },

  onTypingReceived: (data) => {
    const { activeMatchId } = get();
    if (activeMatchId === data.matchId) {
      set({ isPartnerTyping: data.isTyping });
    }
  },

  onReadReceived: (data) => {
    const { activeMatchId, messages } = get();
    if (activeMatchId === data.matchId) {
      const updated = messages.map((m) =>
        m.readAt ? m : { ...m, readAt: data.readAt },
      );
      set({ messages: updated });
    }
  },
}));

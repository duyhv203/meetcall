import { create } from 'zustand';
import type { MatchItem } from '@meetcall/shared';
import { api } from '../lib/api.js';

interface MatchState {
  matches: MatchItem[];
  isLoading: boolean;
  error: string | null;

  fetchMatches: () => Promise<void>;
  unmatch: (matchId: string) => Promise<boolean>;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  isLoading: false,
  error: null,

  fetchMatches: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api<MatchItem[]>('/matches');
      set({ matches: data, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Không thể tải danh sách tương hợp',
        isLoading: false,
      });
    }
  },

  unmatch: async (matchId: string) => {
    try {
      await api<{ success: boolean }>(`/matches/${matchId}`, {
        method: 'DELETE',
      });
      set({
        matches: get().matches.filter((m) => m.id !== matchId),
      });
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Không thể huỷ tương hợp',
      });
      return false;
    }
  },
}));

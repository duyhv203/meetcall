import { create } from 'zustand';
import type { DiscoverCandidate, SwipeAction, SwipeResponse } from '@meetcall/shared';
import { api } from '../lib/api.js';

interface DiscoverState {
  candidates: DiscoverCandidate[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
  newMatch: SwipeResponse['matchedUser'] & { matchId?: string } | null;

  fetchCandidates: () => Promise<void>;
  swipe: (action: SwipeAction) => Promise<SwipeResponse | null>;
  clearNewMatch: () => void;
  nextPhoto: () => void;
  prevPhoto: () => void;
  activePhotoIndex: number;
}

export const useDiscoverStore = create<DiscoverState>((set, get) => ({
  candidates: [],
  currentIndex: 0,
  isLoading: false,
  error: null,
  newMatch: null,
  activePhotoIndex: 0,

  clearNewMatch: () => set({ newMatch: null }),

  nextPhoto: () => {
    const { candidates, currentIndex, activePhotoIndex } = get();
    const current = candidates[currentIndex];
    if (!current || current.photos.length <= 1) return;
    if (activePhotoIndex < current.photos.length - 1) {
      set({ activePhotoIndex: activePhotoIndex + 1 });
    } else {
      set({ activePhotoIndex: 0 });
    }
  },

  prevPhoto: () => {
    const { candidates, currentIndex, activePhotoIndex } = get();
    const current = candidates[currentIndex];
    if (!current || current.photos.length <= 1) return;
    if (activePhotoIndex > 0) {
      set({ activePhotoIndex: activePhotoIndex - 1 });
    } else {
      set({ activePhotoIndex: current.photos.length - 1 });
    }
  },

  fetchCandidates: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api<DiscoverCandidate[]>('/discover?limit=25');
      set({
        candidates: data,
        currentIndex: 0,
        activePhotoIndex: 0,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Không thể tải ứng viên',
        isLoading: false,
      });
    }
  },

  swipe: async (action: SwipeAction) => {
    const { candidates, currentIndex } = get();
    const candidate = candidates[currentIndex];
    if (!candidate) return null;

    // Optimistically advance to next candidate
    set({
      currentIndex: currentIndex + 1,
      activePhotoIndex: 0,
    });

    try {
      const res = await api<SwipeResponse>('/swipes', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: candidate.userId,
          action,
        }),
      });

      if (res.match && res.matchedUser) {
        set({
          newMatch: {
            ...res.matchedUser,
            matchId: res.matchId,
          },
        });
      }

      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi khi quẹt';
      set({ error: message });
      return null;
    }
  },
}));

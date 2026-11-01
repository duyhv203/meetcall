import { create } from 'zustand';
import type {
  MeResponse,
  PhotoData,
  ProfileData,
  PreferencesData,
  UpdateLocationRequest,
  UpdatePreferencesRequest,
  UpdateProfileRequest,
} from '@meetcall/shared';
import { api } from '../lib/api.js';

interface ProfileState {
  me: MeResponse | null;
  isLoading: boolean;
  error: string | null;

  fetchMe: () => Promise<MeResponse | null>;
  updateProfile: (dto: UpdateProfileRequest) => Promise<ProfileData>;
  updatePreferences: (dto: UpdatePreferencesRequest) => Promise<PreferencesData>;
  updateLocation: (dto: UpdateLocationRequest) => Promise<void>;
  uploadPhoto: (file: File) => Promise<PhotoData>;
  deletePhoto: (photoId: string) => Promise<void>;
  reorderPhotos: (photoIds: string[]) => Promise<PhotoData[]>;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  me: null,
  isLoading: false,
  error: null,

  clearProfile: () => set({ me: null, error: null }),

  fetchMe: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api<MeResponse>('/me');
      set({ me: data, isLoading: false });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải thông tin hồ sơ';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  updateProfile: async (dto: UpdateProfileRequest) => {
    const updated = await api<ProfileData>('/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
    const current = get().me;
    if (current) {
      set({
        me: {
          ...current,
          profile: updated,
        },
      });
    }
    return updated;
  },

  updatePreferences: async (dto: UpdatePreferencesRequest) => {
    const res = await api<{ success: boolean; preferences?: PreferencesData }>('/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
    const current = get().me;
    const nextPrefs = res.preferences || {
      userId: current?.user.id || '',
      genderFilter: dto.genderFilter,
      minAge: dto.minAge,
      maxAge: dto.maxAge,
      maxDistanceKm: dto.maxDistanceKm,
    };
    if (current) {
      set({
        me: {
          ...current,
          preferences: nextPrefs,
        },
      });
    }
    return nextPrefs;
  },

  updateLocation: async (dto: UpdateLocationRequest) => {
    await api<{ success: boolean }>('/me/location', {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
    await get().fetchMe();
  },

  uploadPhoto: async (file: File) => {
    // 1. Get presigned upload URL
    const { uploadUrl, key } = await api<{
      uploadUrl: string;
      publicUrl: string;
      key: string;
      expiresIn: number;
    }>('/me/photos/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        contentType: file.type || 'image/jpeg',
        size: file.size,
      }),
    });

    // 2. Direct upload file binary to uploadUrl (normalize localhost:3000 to proxy path)
    const normalizedUploadUrl = uploadUrl.replace(/^http:\/\/localhost:3000/, '');
    const uploadRes = await fetch(normalizedUploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
      },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error(`Tải ảnh lên thất bại (${uploadRes.status})`);
    }

    // 3. Confirm photo creation
    const photo = await api<PhotoData>('/me/photos', {
      method: 'POST',
      body: JSON.stringify({ key }),
    });

    await get().fetchMe();
    return photo;
  },

  deletePhoto: async (photoId: string) => {
    await api<{ success: boolean }>(`/me/photos/${photoId}`, {
      method: 'DELETE',
    });
    await get().fetchMe();
  },

  reorderPhotos: async (photoIds: string[]) => {
    const res = await api<PhotoData[]>('/me/photos/order', {
      method: 'PATCH',
      body: JSON.stringify({ ids: photoIds }),
    });
    const current = get().me;
    const nextPhotos = Array.isArray(res) ? res : (res as any)?.photos || [];
    if (current) {
      set({
        me: {
          ...current,
          photos: nextPhotos,
        },
      });
    }
    return nextPhotos;
  },
}));

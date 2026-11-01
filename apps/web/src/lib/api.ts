import type { ApiErrorPayload, AuthResponse } from '@meetcall/shared';

export class ApiError extends Error {
  code: string;
  error?: { code: string; message: string };

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.error = { code, message };
  }
}

let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function onRefreshed(token: string | null): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

const getBaseApiUrl = (): string => {
  return (import.meta.env.VITE_API_URL as string) || '';
};

export const buildApiUrl = (path: string): string => {
  const base = getBaseApiUrl().replace(/\/$/, '');
  const prefix = path.startsWith('/api') ? path : `/api/v1${path}`;
  return base ? `${base}${prefix}` : prefix;
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = buildApiUrl(path);

  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const executeRequest = async (): Promise<Response> => {
    return fetch(url, {
      ...init,
      headers,
      credentials: 'include', // Includes httpOnly cookie for refresh token
    });
  };

  let response = await executeRequest();

  // If 401 Unauthorized and not already calling refresh or login
  if (response.status === 401 && !path.includes('/auth/refresh') && !path.includes('/auth/login')) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const refreshRes = await fetch(buildApiUrl('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as AuthResponse;
          setAccessToken(data.accessToken);
          onRefreshed(data.accessToken);
          isRefreshing = false;

          headers.set('Authorization', `Bearer ${data.accessToken}`);
          response = await executeRequest();
        } else {
          isRefreshing = false;
          setAccessToken(null);
          onRefreshed(null);
          if (
            window.location.pathname !== '/login' &&
            window.location.pathname !== '/register' &&
            window.location.pathname !== '/forgot-password' &&
            window.location.pathname !== '/reset-password'
          ) {
            window.location.href = '/login';
          }
          const err = (await response.json().catch(() => ({}))) as ApiErrorPayload;
          throw err;
        }
      } catch (refreshErr) {
        isRefreshing = false;
        setAccessToken(null);
        onRefreshed(null);
        throw refreshErr;
      }
    } else {
      // If already refreshing, wait for new token
      return new Promise<T>((resolve, reject) => {
        refreshSubscribers.push(async (newToken) => {
          if (newToken) {
            headers.set('Authorization', `Bearer ${newToken}`);
            try {
              const retryRes = await executeRequest();
              if (!retryRes.ok) {
                const err = (await retryRes.json().catch(() => ({}))) as ApiErrorPayload;
                reject(err);
                return;
              }
              const data = (await retryRes.json()) as T;
              resolve(data);
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error('SESSION_EXPIRED'));
          }
        });
      });
    }
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({
      error: {
        code: `HTTP_${response.status}`,
        message: response.statusText || 'Có lỗi xảy ra khi gửi yêu cầu',
      },
    }))) as ApiErrorPayload;

    const message = errorBody?.error?.message || response.statusText || 'Có lỗi xảy ra khi gửi yêu cầu';
    const code = errorBody?.error?.code || `HTTP_${response.status}`;
    throw new ApiError(code, message);
  }

  return response.json() as Promise<T>;
}

export function resolvePhotoUrl(url?: string | null): string {
  if (!url) return '';
  const base = getBaseApiUrl().replace(/\/$/, '');
  if (/^http:\/\/localhost:\d+/.test(url)) {
    const rel = url.replace(/^http:\/\/localhost:\d+/, '');
    return base ? `${base}${rel}` : rel;
  }
  return url;
}


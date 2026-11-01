import type { ApiErrorPayload, AuthResponse } from '@meetcall/shared';

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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('/api') ? path : `/api/v1${path}`;

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
        const refreshRes = await fetch('/api/v1/auth/refresh', {
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

    throw errorBody;
  }

  return response.json() as Promise<T>;
}

import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api.js';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = getAccessToken();
    const socketUrl =
      (import.meta.env.VITE_SOCKET_URL as string) ||
      (import.meta.env.VITE_API_URL as string) ||
      'http://localhost:3000';
    socket = io(socketUrl, {
      auth: { token: token ? `Bearer ${token}` : '' },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  const token = getAccessToken();
  if (token) {
    s.auth = { token: `Bearer ${token}` };
  }
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

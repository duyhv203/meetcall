import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api.js';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = getAccessToken();
    socket = io('http://localhost:3000', {
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

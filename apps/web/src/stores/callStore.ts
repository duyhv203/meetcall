import { create } from 'zustand';
import type {
  CallIncomingPayload,
  IceServersResponse,
  InitiateCallResponse,
} from '@meetcall/shared';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

interface CallState {
  callId: string | null;
  matchId: string | null;
  status: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';
  incomingCall: CallIncomingPayload | null;
  partner: { id: string; displayName: string; avatar: string | null } | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicMuted: boolean;
  isCameraOff: boolean;
  durationSeconds: number;
  error: string | null;

  initiateCall: (
    matchId: string,
    partner: { id: string; displayName: string; avatar: string | null },
  ) => Promise<boolean>;
  setIncomingCall: (payload: CallIncomingPayload) => void;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => void;
  toggleCamera: () => void;
  setRemoteStream: (stream: MediaStream) => void;
  incrementDuration: () => void;
  resetCallState: () => void;
}

let peerConnection: RTCPeerConnection | null = null;
const pendingCandidates: RTCIceCandidateInit[] = [];

export const useCallStore = create<CallState>((set, get) => ({
  callId: null,
  matchId: null,
  status: 'idle',
  incomingCall: null,
  partner: null,
  localStream: null,
  remoteStream: null,
  isMicMuted: false,
  isCameraOff: false,
  durationSeconds: 0,
  error: null,

  resetCallState: () => {
    // Stop local tracks to turn off camera/mic
    const { localStream } = get();
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    pendingCandidates.length = 0;

    set({
      callId: null,
      matchId: null,
      status: 'idle',
      incomingCall: null,
      partner: null,
      localStream: null,
      remoteStream: null,
      durationSeconds: 0,
      error: null,
    });
  },

  setIncomingCall: (payload) => {
    set({
      incomingCall: payload,
      callId: payload.callId,
      matchId: payload.matchId || null,
      partner: payload.caller,
      status: 'incoming',
    });
  },

  initiateCall: async (matchId, partner) => {
    set({
      matchId,
      partner,
      status: 'calling',
      durationSeconds: 0,
      error: null,
    });

    try {
      // 1. Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      set({ localStream: stream });

      // 2. Call API initiate
      const res = await api<InitiateCallResponse>('/calls/initiate', {
        method: 'POST',
        body: JSON.stringify({ matchId }),
      });

      set({ callId: res.callId });

      // 3. Prepare WebRTC Peer Connection
      const { iceServers } = await api<IceServersResponse>('/calls/ice-servers');
      peerConnection = new RTCPeerConnection({ iceServers });

      // Add local tracks
      stream.getTracks().forEach((track) => {
        peerConnection?.addTrack(track, stream);
      });

      // Handle remote tracks
      const remote = new MediaStream();
      peerConnection.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          remote.addTrack(track);
        });
        set({ remoteStream: remote });
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && res.calleeId) {
          const socket = getSocket();
          socket.emit('rtc:signal', {
            callId: res.callId,
            targetUserId: res.calleeId,
            signal: { candidate: event.candidate },
          });
        }
      };

      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const socket = getSocket();
      socket.emit('rtc:signal', {
        callId: res.callId,
        targetUserId: res.calleeId,
        signal: { sdp: offer },
      });

      return true;
    } catch (err) {
      get().resetCallState();
      set({
        error: err instanceof Error ? err.message : 'Không thể khởi tạo cuộc gọi',
      });
      return false;
    }
  },

  acceptCall: async () => {
    const { callId, partner } = get();
    if (!callId || !partner) return;

    try {
      set({ status: 'connected', error: null });

      // 1. Get media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      set({ localStream: stream });

      // 2. Call API accept
      await api<{ success: boolean }>(`/calls/${callId}/accept`, {
        method: 'POST',
      });

      // 3. Prepare WebRTC Peer Connection
      const { iceServers } = await api<IceServersResponse>('/calls/ice-servers');
      peerConnection = new RTCPeerConnection({ iceServers });

      stream.getTracks().forEach((track) => {
        peerConnection?.addTrack(track, stream);
      });

      const remote = new MediaStream();
      peerConnection.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          remote.addTrack(track);
        });
        set({ remoteStream: remote });
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = getSocket();
          socket.emit('rtc:signal', {
            callId,
            targetUserId: partner.id,
            signal: { candidate: event.candidate },
          });
        }
      };

      // Apply any buffered candidates
      for (const cand of pendingCandidates) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
      }
      pendingCandidates.length = 0;
    } catch (err) {
      get().resetCallState();
      set({
        error: err instanceof Error ? err.message : 'Nhận cuộc gọi thất bại',
      });
    }
  },

  declineCall: async () => {
    const { callId } = get();
    if (callId) {
      try {
        await api<{ success: boolean }>(`/calls/${callId}/decline`, {
          method: 'POST',
        });
        const socket = getSocket();
        socket.emit('call:decline', { callId });
      } catch {
        // Ignore decline errors
      }
    }
    get().resetCallState();
  },

  endCall: async () => {
    const { callId } = get();
    if (callId) {
      try {
        await api<{ success: boolean }>(`/calls/${callId}/end`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'completed' }),
        });
        const socket = getSocket();
        socket.emit('call:end', { callId });
      } catch {
        // Ignore end errors
      }
    }
    get().resetCallState();
  },

  toggleMic: () => {
    const { localStream, isMicMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicMuted;
      });
      set({ isMicMuted: !isMicMuted });
    }
  },

  toggleCamera: () => {
    const { localStream, isCameraOff } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOff;
      });
      set({ isCameraOff: !isCameraOff });
    }
  },

  setRemoteStream: (stream) => set({ remoteStream: stream }),
  incrementDuration: () => set((state) => ({ durationSeconds: state.durationSeconds + 1 })),
}));

// Global WebRTC signal dispatcher
export async function handleIncomingSignal(payload: {
  callId: string;
  senderId: string;
  signal: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
}) {
  const { signal } = payload;

  if (signal.sdp) {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));

    if (signal.sdp.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      const socket = getSocket();
      socket.emit('rtc:signal', {
        callId: payload.callId,
        targetUserId: payload.senderId,
        signal: { sdp: answer },
      });
    }
  } else if (signal.candidate) {
    if (peerConnection && peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } else {
      pendingCandidates.push(signal.candidate);
    }
  }
}

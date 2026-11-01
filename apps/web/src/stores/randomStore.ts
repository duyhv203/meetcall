import { create } from 'zustand';
import type {
  FriendVoteResponse,
  IceServersResponse,
  RandomPairedPartner,
  RandomPairedPayload,
} from '@meetcall/shared';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

export interface RandomFilterOptions {
  preferredGender?: string;
  minAge?: number;
  maxAge?: number;
  preferredCity?: string;
}

interface RandomState {
  pairingStatus: 'idle' | 'waiting' | 'connected';
  callId: string | null;
  partner: RandomPairedPartner | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isInitiator: boolean;
  votedFriend: boolean;
  friendMatched: boolean;
  isMicMuted: boolean;
  isCameraOff: boolean;
  error: string | null;

  startRandomCall: (filterOptions?: RandomFilterOptions | string) => Promise<void>;
  nextPartner: (filterOptions?: RandomFilterOptions | string) => Promise<void>;
  leaveRandomCall: () => void;
  voteFriend: () => Promise<void>;
  toggleMic: () => void;
  toggleCamera: () => void;
  onPaired: (payload: RandomPairedPayload) => Promise<void>;
  handleIncomingSignal: (payload: {
    callId: string;
    senderId: string;
    signal: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
  }) => Promise<void>;
  onPartnerLeft: () => void;
}

let peerConnection: RTCPeerConnection | null = null;
const pendingCandidates: RTCIceCandidateInit[] = [];

export const useRandomStore = create<RandomState>((set, get) => ({
  pairingStatus: 'idle',
  callId: null,
  partner: null,
  localStream: null,
  remoteStream: null,
  isInitiator: false,
  votedFriend: false,
  friendMatched: false,
  isMicMuted: false,
  isCameraOff: false,
  error: null,

  startRandomCall: async (filterOptions?: RandomFilterOptions | string) => {
    set({
      pairingStatus: 'waiting',
      partner: null,
      callId: null,
      votedFriend: false,
      friendMatched: false,
      error: null,
    });

    try {
      // 1. Acquire media if not acquired
      let stream = get().localStream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        set({ localStream: stream });
      }

      // 2. Emit random:join
      const socket = getSocket();
      const payload = typeof filterOptions === 'string'
        ? { preferredGender: filterOptions }
        : filterOptions || {};
      socket.emit('random:join', payload);
    } catch (err) {
      set({
        pairingStatus: 'idle',
        error: err instanceof Error ? err.message : 'Không thể truy cập camera/micro',
      });
    }
  },

  onPaired: async (payload: RandomPairedPayload) => {
    set({
      callId: payload.callId,
      partner: payload.partner,
      isInitiator: payload.initiator,
      pairingStatus: 'connected',
      votedFriend: false,
      friendMatched: false,
      error: null,
    });

    try {
      const { localStream } = get();
      if (!localStream) return;

      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      pendingCandidates.length = 0;

      const { iceServers } = await api<IceServersResponse>('/calls/ice-servers');
      peerConnection = new RTCPeerConnection({ iceServers });

      localStream.getTracks().forEach((track) => {
        peerConnection?.addTrack(track, localStream);
      });

      const remote = new MediaStream();
      peerConnection.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          remote.addTrack(track);
        });
        set({ remoteStream: remote });
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && payload.partner.id) {
          const socket = getSocket();
          socket.emit('rtc:signal', {
            callId: payload.callId,
            targetUserId: payload.partner.id,
            signal: { candidate: event.candidate },
          });
        }
      };

      if (payload.initiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        const socket = getSocket();
        socket.emit('rtc:signal', {
          callId: payload.callId,
          targetUserId: payload.partner.id,
          signal: { sdp: offer },
        });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Lỗi thiết lập WebRTC ngẫu nhiên',
      });
    }
  },

  handleIncomingSignal: async (payload: {
    callId: string;
    senderId: string;
    signal: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
  }) => {
    const { signal, senderId, callId } = payload;
    const { partner } = get();

    if (!partner || partner.id !== senderId) return;

    try {
      if (signal.sdp) {
        if (!peerConnection) return;
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        while (pendingCandidates.length > 0) {
          const candidate = pendingCandidates.shift();
          if (candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
        }

        if (signal.sdp.type === 'offer') {
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          const socket = getSocket();
          socket.emit('rtc:signal', {
            callId,
            targetUserId: senderId,
            signal: { sdp: answer },
          });
        }
      } else if (signal.candidate) {
        if (peerConnection && peerConnection.remoteDescription) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        } else {
          pendingCandidates.push(signal.candidate);
        }
      }
    } catch (err) {
      console.error('Lỗi xử lý signaling WebRTC ngẫu nhiên:', err);
    }
  },

  nextPartner: async (filterOptions?: RandomFilterOptions | string) => {
    const { callId } = get();
    const socket = getSocket();

    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    pendingCandidates.length = 0;

    set({
      pairingStatus: 'waiting',
      partner: null,
      callId: null,
      remoteStream: null,
      votedFriend: false,
      friendMatched: false,
      error: null,
    });

    const payload = typeof filterOptions === 'string'
      ? { callId, preferredGender: filterOptions }
      : { callId, ...(filterOptions || {}) };
    socket.emit('random:next', payload);
  },

  onPartnerLeft: () => {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    pendingCandidates.length = 0;

    set({
      remoteStream: null,
      pairingStatus: 'waiting',
      partner: null,
      callId: null,
      votedFriend: false,
    });
  },

  leaveRandomCall: () => {
    const { callId, localStream } = get();
    const socket = getSocket();

    socket.emit('random:leave', { callId });

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    pendingCandidates.length = 0;

    set({
      pairingStatus: 'idle',
      callId: null,
      partner: null,
      localStream: null,
      remoteStream: null,
      votedFriend: false,
      friendMatched: false,
      error: null,
    });
  },

  voteFriend: async () => {
    const { callId, votedFriend } = get();
    if (!callId || votedFriend) return;

    try {
      set({ votedFriend: true });
      const res = await api<FriendVoteResponse>(`/calls/${callId}/friend-vote`, {
        method: 'POST',
        body: JSON.stringify({ wantsFriend: true }),
      });

      if (res.matchCreated) {
        set({ friendMatched: true });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Bình chọn kết bạn thất bại',
      });
    }
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
}));

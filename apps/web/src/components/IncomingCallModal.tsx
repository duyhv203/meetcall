import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCallStore, handleIncomingSignal } from '../stores/callStore.js';
import { connectSocket } from '../lib/socket.js';
import type { CallIncomingPayload } from '@meetcall/shared';

export function IncomingCallModal() {
  const navigate = useNavigate();
  const {
    status,
    incomingCall,
    setIncomingCall,
    acceptCall,
    declineCall,
    resetCallState,
  } = useCallStore();

  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Play synthetic pleasant ringtone
  const startRingtone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const playChime = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      };

      playChime();
      ringtoneIntervalRef.current = setInterval(playChime, 2500);
    } catch {
      // Ignore audio autoplay restrictions
    }
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  useEffect(() => {
    const socket = connectSocket();

    const onIncoming = (data: CallIncomingPayload) => {
      setIncomingCall(data);
      startRingtone();
    };

    const onAccepted = () => {
      stopRingtone();
      useCallStore.setState({ status: 'connected' });
    };

    const onDeclined = () => {
      stopRingtone();
      resetCallState();
    };

    const onEnded = () => {
      stopRingtone();
      resetCallState();
    };

    const onMissed = () => {
      stopRingtone();
      resetCallState();
    };

    const onSignal = (payload: any) => {
      void handleIncomingSignal(payload);
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:declined', onDeclined);
    socket.on('call:ended', onEnded);
    socket.on('call:missed', onMissed);
    socket.on('rtc:signal', onSignal);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:declined', onDeclined);
      socket.off('call:ended', onEnded);
      socket.off('call:missed', onMissed);
      socket.off('rtc:signal', onSignal);
      stopRingtone();
    };
  }, [setIncomingCall, resetCallState]);

  if (status !== 'incoming' || !incomingCall) {
    return null;
  }

  const handleAccept = async () => {
    stopRingtone();
    await acceptCall();
    if (incomingCall.matchId) {
      navigate(`/call/${incomingCall.matchId}`);
    } else {
      navigate('/call');
    }
  };

  const handleDecline = async () => {
    stopRingtone();
    await declineCall();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-gradient-to-b from-slate-900 to-slate-950 border border-rose-500/30 rounded-3xl p-6 text-center space-y-6 shadow-2xl shadow-rose-500/20 animate-bounce-slight">
        <div className="flex items-center justify-center gap-2 text-rose-400">
          <Video className="w-6 h-6 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Cuộc gọi video đến...
          </span>
        </div>

        {/* Caller Avatar */}
        <div className="relative mx-auto w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-rose-500 to-orange-400 shadow-xl shadow-rose-500/30">
          {incomingCall.caller.avatar ? (
            <img
              src={incomingCall.caller.avatar}
              alt={incomingCall.caller.displayName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-3xl font-bold text-rose-400">
              {incomingCall.caller.displayName[0]}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xl font-bold text-white">
            {incomingCall.caller.displayName}
          </h3>
          <p className="text-xs text-slate-400 mt-1">Đang mời bạn tham gia gọi video</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-8 pt-2">
          <button
            type="button"
            onClick={() => void handleDecline()}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition transform hover:scale-110 active:scale-95"
            title="Từ chối"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={() => void handleAccept()}
            className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition transform hover:scale-110 active:scale-95 animate-pulse"
            title="Nhận cuộc gọi"
          >
            <Phone className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}

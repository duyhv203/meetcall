import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Sparkles,
} from 'lucide-react';
import { useCallStore } from '../../stores/callStore.js';
import { useMatchStore } from '../../stores/matchStore.js';

export function CallPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { matches } = useMatchStore();
  const {
    status,
    partner,
    localStream,
    remoteStream,
    isMicMuted,
    isCameraOff,
    durationSeconds,
    error,
    initiateCall,
    endCall,
    toggleMic,
    toggleCamera,
    incrementDuration,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Auto-initiate call if arriving directly from Chat or Matches
  useEffect(() => {
    if (status === 'idle' && matchId) {
      const match = matches.find((m) => m.id === matchId);
      if (match?.partner) {
        void initiateCall(matchId, {
          id: match.partner.id,
          displayName: match.partner.displayName,
          avatar: match.partner.avatar,
        });
      }
    }
  }, [status, matchId, matches, initiateCall]);

  // Connect local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Connect remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Call duration timer
  useEffect(() => {
    if (status !== 'connected') return;
    const timer = setInterval(() => {
      incrementDuration();
    }, 1000);
    return () => clearInterval(timer);
  }, [status, incrementDuration]);

  const handleEnd = async () => {
    await endCall();
    if (matchId) {
      navigate(`/chat/${matchId}`);
    } else {
      navigate('/matches');
    }
  };

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative h-screen w-screen bg-slate-950 overflow-hidden flex flex-col justify-between">
      {/* Remote Video (Main full-screen background) */}
      <div className="absolute inset-0 z-0 bg-slate-900 flex items-center justify-center">
        {remoteStream && remoteStream.getVideoTracks().length > 0 ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <div className="relative w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-rose-500 to-orange-400">
              {partner?.avatar ? (
                <img
                  src={partner.avatar}
                  alt={partner.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-4xl font-bold text-rose-400">
                  {partner?.displayName?.[0] || 'U'}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white">
                {partner?.displayName || 'Người dùng'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {status === 'calling'
                  ? 'Đang đổ chuông...'
                  : status === 'connected'
                  ? 'Đã kết nối (Chưa bật camera)'
                  : 'Đang kết nối...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Top Overlay Bar */}
      <div className="relative z-10 p-4 sm:p-6 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white drop-shadow">
              {partner?.displayName}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {status === 'connected'
                  ? formatDuration(durationSeconds)
                  : status === 'calling'
                  ? 'Đang gọi...'
                  : 'Đang kết nối'}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-3 py-1 bg-red-600/80 rounded-xl text-white text-xs backdrop-blur-sm">
            {error}
          </div>
        )}
      </div>

      {/* Local Video Thumbnail (PiP at corner) */}
      <div className="relative z-10 self-end mr-4 mb-4 sm:mr-6 sm:mb-6 w-32 h-44 sm:w-40 sm:h-56 rounded-2xl overflow-hidden border-2 border-slate-700 bg-black shadow-2xl">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
        />
        {isCameraOff && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500 gap-1">
            <VideoOff className="w-6 h-6" />
            <span className="text-[10px]">Camera tắt</span>
          </div>
        )}
      </div>

      {/* Floating Bottom Controls */}
      <div className="relative z-10 pb-8 flex items-center justify-center gap-4 sm:gap-6 bg-gradient-to-t from-black/80 to-transparent pt-6">
        {/* Toggle Mic */}
        <button
          type="button"
          onClick={toggleMic}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition shadow-lg ${
            isMicMuted
              ? 'bg-red-600 text-white'
              : 'bg-slate-800/80 hover:bg-slate-700 text-white backdrop-blur-md'
          }`}
          title={isMicMuted ? 'Bật Mic' : 'Tắt Mic'}
        >
          {isMicMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={() => void handleEnd()}
          className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl shadow-red-600/40 transition transform hover:scale-105 active:scale-95"
          title="Kết thúc cuộc gọi"
        >
          <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>

        {/* Toggle Camera */}
        <button
          type="button"
          onClick={toggleCamera}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition shadow-lg ${
            isCameraOff
              ? 'bg-red-600 text-white'
              : 'bg-slate-800/80 hover:bg-slate-700 text-white backdrop-blur-md'
          }`}
          title={isCameraOff ? 'Bật Camera' : 'Tắt Camera'}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
      </div>
    </div>
  );
}

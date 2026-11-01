import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  Mic,
  MicOff,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Video,
  VideoOff,
} from 'lucide-react';
import { useRandomStore } from '../../stores/randomStore.js';
import { connectSocket } from '../../lib/socket.js';
import type { RandomPairedPayload } from '@meetcall/shared';

export function RandomPage() {
  const navigate = useNavigate();
  const {
    pairingStatus,
    partner,
    localStream,
    remoteStream,
    votedFriend,
    friendMatched,
    isMicMuted,
    isCameraOff,
    error,
    startRandomCall,
    nextPartner,
    leaveRandomCall,
    voteFriend,
    toggleMic,
    toggleCamera,
    onPaired,
    onPartnerLeft,
  } = useRandomStore();

  const [hasAgreedRules, setHasAgreedRules] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(true);
  const [preferredGender, setPreferredGender] = useState('other');

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Setup Socket listeners for random calls
  useEffect(() => {
    const socket = connectSocket();

    const handlePaired = (payload: RandomPairedPayload) => {
      void onPaired(payload);
    };

    const handlePartnerLeft = () => {
      onPartnerLeft();
    };

    socket.on('random:paired', handlePaired);
    socket.on('random:partner_left', handlePartnerLeft);

    return () => {
      socket.off('random:paired', handlePaired);
      socket.off('random:partner_left', handlePartnerLeft);
      leaveRandomCall();
    };
  }, [onPaired, onPartnerLeft, leaveRandomCall]);

  // Connect local video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Connect remote video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Keyboard shortcut Space for Next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && pairingStatus === 'connected') {
        e.preventDefault();
        void nextPartner(preferredGender);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pairingStatus, nextPartner, preferredGender]);

  const handleStart = async () => {
    if (!hasAgreedRules) return;
    setShowRulesModal(false);
    await startRandomCall(preferredGender);
  };

  const handleLeave = () => {
    leaveRandomCall();
    navigate('/');
  };

  return (
    <div className="relative h-screen w-screen bg-slate-950 overflow-hidden flex flex-col justify-between select-none">
      {/* Top Navbar */}
      <header className="relative z-20 px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLeave}
            className="p-1.5 rounded-xl bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            <h1 className="text-base font-bold text-white">Video Call Ngẫu Nhiên</h1>
          </div>
        </div>

        {partner && (
          <div className="px-3 py-1 bg-slate-900/80 border border-slate-700/60 rounded-xl text-xs font-semibold text-slate-200">
            {partner.displayName}, {partner.age} ·{' '}
            {partner.gender === 'female' ? 'Nữ' : partner.gender === 'male' ? 'Nam' : 'Khác'}
          </div>
        )}
      </header>

      {/* Main Video Viewport */}
      <div className="absolute inset-0 z-0 bg-slate-900 flex items-center justify-center">
        {pairingStatus === 'connected' && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : pairingStatus === 'waiting' ? (
          /* Waiting Radar Screen */
          <div className="flex flex-col items-center gap-6 text-center p-6">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
              <div className="absolute inset-4 rounded-full bg-rose-500/30 animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-rose-500 to-purple-600 flex items-center justify-center shadow-xl shadow-purple-500/30">
                <Sparkles className="w-8 h-8 text-white animate-spin-slow" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Đang tìm bạn mới...</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Hệ thống đang ghép cặp bạn với một người dùng 18+ ngẫu nhiên đang trực tuyến.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-slate-500 text-sm">Chưa bắt đầu kết nối</div>
        )}
      </div>

      {/* Local Video Thumbnail (PiP) */}
      {pairingStatus !== 'idle' && (
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
      )}

      {/* Floating Bottom Controls */}
      {pairingStatus !== 'idle' && (
        <div className="relative z-10 pb-8 flex items-center justify-center gap-4 sm:gap-6 bg-gradient-to-t from-black/90 to-transparent pt-6">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg ${
              isMicMuted ? 'bg-red-600 text-white' : 'bg-slate-800/80 text-white'
            }`}
            title="Mic"
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Next Button */}
          <button
            type="button"
            onClick={() => void nextPartner(preferredGender)}
            className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition transform hover:scale-105 active:scale-95"
            title="Chuyển sang người khác (Phím Space)"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Chuyển người (Space)</span>
          </button>

          {/* Friend Vote Button */}
          {pairingStatus === 'connected' && (
            <button
              type="button"
              onClick={() => void voteFriend()}
              disabled={votedFriend}
              className={`flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm shadow-xl transition transform hover:scale-105 active:scale-95 ${
                votedFriend
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-default'
                  : 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-rose-500/30'
              }`}
              title="Kết bạn"
            >
              <Heart className={`w-5 h-5 ${votedFriend ? 'fill-rose-400' : ''}`} />
              <span>{votedFriend ? 'Đã thích' : 'Kết bạn'}</span>
            </button>
          )}

          {/* Toggle Camera */}
          <button
            type="button"
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg ${
              isCameraOff ? 'bg-red-600 text-white' : 'bg-slate-800/80 text-white'
            }`}
            title="Camera"
          >
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Community Rules Acceptance Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <ShieldAlert className="w-8 h-8 flex-shrink-0" />
              <h2 className="text-lg font-bold text-white">Quy tắc cộng đồng an toàn</h2>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80">
              <p className="font-semibold text-rose-400">
                1. Tính năng gọi ngẫu nhiên chỉ dành cho người đủ 18 tuổi trở lên.
              </p>
              <p>
                2. Nghiêm cấm tuyệt đối mọi hành vi khoả thân, khiêu dâm, quấy rối tình dục, bạo lực hoặc ngôn từ thù địch.
              </p>
              <p>
                3. Hệ thống kiểm duyệt tự động và báo cáo cộng đồng sẽ tự động khoá vĩnh viễn tài khoản vi phạm và lưu trữ dữ liệu để chuyển giao cơ quan chức năng khi cần thiết.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Bộ lọc giới tính mong muốn:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'other', label: 'Tất cả' },
                  { id: 'female', label: 'Nữ' },
                  { id: 'male', label: 'Nam' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreferredGender(opt.id)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${
                      preferredGender === opt.id
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasAgreedRules}
                onChange={(e) => setHasAgreedRules(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-rose-500"
              />
              <span className="text-xs text-slate-300 leading-tight">
                Tôi cam kết đủ 18 tuổi và đồng ý tuân thủ toàn bộ quy tắc cộng đồng trên MeetCall.
              </span>
            </label>

            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Link
                to="/"
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition text-center"
              >
                Quay lại
              </Link>
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={!hasAgreedRules}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 font-bold text-xs text-white shadow-lg shadow-rose-500/20 transition disabled:opacity-50"
              >
                Bắt đầu tìm bạn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friend Matched Celebration Popup */}
      {friendMatched && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-gradient-to-b from-slate-900 to-slate-950 border border-rose-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center shadow-lg shadow-rose-500/30">
              <Heart className="w-8 h-8 fill-rose-500" />
            </div>

            <h3 className="text-2xl font-extrabold text-white">Đã Kết Bạn Thành Công!</h3>
            <p className="text-xs text-slate-300">
              Cả hai bạn đều đã thích nhau. Người này đã được thêm vào danh sách Tương hợp của bạn để nhắn tin và gọi lại bất cứ lúc nào!
            </p>

            <button
              type="button"
              onClick={() => useRandomStore.setState({ friendMatched: false })}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-semibold text-xs shadow-md shadow-rose-500/25"
            >
              Tiếp tục trò chuyện
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from 'react';
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
  Crown,
  X,
  Globe,
} from 'lucide-react';
import { useRandomStore, type RandomFilterOptions } from '../../stores/randomStore.js';
import { connectSocket } from '../../lib/socket.js';
import { api } from '../../lib/api.js';
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

  // Filter settings
  const [filterMode, setFilterMode] = useState<'free' | 'vip'>('free');
  const [preferredGender, setPreferredGender] = useState('other');
  const [ageRange, setAgeRange] = useState('all');
  const [preferredCity, setPreferredCity] = useState('');

  // VIP State
  const [isVip, setIsVip] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [vipSuccess, setVipSuccess] = useState('');
  const [isVipLoading, setIsVipLoading] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Check VIP status on mount
  useEffect(() => {
    api<{ isVip: boolean }>('/random/vip-status')
      .then((res) => setIsVip(res.isVip))
      .catch(() => {});
  }, []);

  const getActiveFilterOptions = useCallback((): RandomFilterOptions => {
    if (filterMode === 'free') {
      return { preferredGender: 'other' };
    }
    let minAge: number | undefined;
    let maxAge: number | undefined;
    if (ageRange === '18-22') {
      minAge = 18;
      maxAge = 22;
    } else if (ageRange === '23-28') {
      minAge = 23;
      maxAge = 28;
    } else if (ageRange === '29-35') {
      minAge = 29;
      maxAge = 35;
    }
    return {
      preferredGender,
      minAge,
      maxAge,
      preferredCity: preferredCity || undefined,
    };
  }, [filterMode, preferredGender, ageRange, preferredCity]);

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
        void nextPartner(getActiveFilterOptions());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pairingStatus, nextPartner, getActiveFilterOptions]);

  const handleStart = async () => {
    if (!hasAgreedRules) return;
    if (filterMode === 'vip' && !isVip) {
      setShowVipModal(true);
      return;
    }
    setShowRulesModal(false);
    await startRandomCall(getActiveFilterOptions());
  };

  const handleUpgradeVip = async (packageId: string) => {
    try {
      setIsVipLoading(true);
      const res = await api<{ success: boolean; message: string; isVip: boolean }>('/random/vip-upgrade', {
        method: 'POST',
        body: JSON.stringify({ packageId }),
      });
      setIsVip(res.isVip);
      setVipSuccess(res.message);
      setTimeout(() => {
        setVipSuccess('');
        setShowVipModal(false);
      }, 1500);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Nâng cấp VIP thất bại');
    } finally {
      setIsVipLoading(false);
    }
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

            {/* MODE SELECTION: FREE VS VIP FILTER */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-200">
                Lựa chọn chế độ gọi:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('free');
                    setPreferredGender('other');
                    setAgeRange('all');
                    setPreferredCity('');
                  }}
                  className={`p-3 rounded-2xl border text-left transition relative ${
                    filterMode === 'free'
                      ? 'bg-rose-500/15 border-rose-500 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-white">
                      <Globe className="w-4 h-4 text-emerald-400" />
                      Ngẫu nhiên
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                      FREE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Miễn phí 100% · Ghép đôi nhanh toàn quốc
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('vip');
                    if (!isVip) {
                      setShowVipModal(true);
                    }
                  }}
                  className={`p-3 rounded-2xl border text-left transition relative ${
                    filterMode === 'vip'
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-amber-300">
                      <Crown className="w-4 h-4 text-amber-400" />
                      Lọc VIP
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                      {isVip ? 'ĐÃ MỞ' : 'TRẢ PHÍ'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Chọn riêng Nữ, độ tuổi và khu vực
                  </p>
                </button>
              </div>
            </div>

            {/* VIP FILTERS SECTION */}
            {filterMode === 'vip' && (
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/30 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    Bộ lọc theo yêu cầu riêng (VIP)
                  </span>
                  {!isVip && (
                    <button
                      type="button"
                      onClick={() => setShowVipModal(true)}
                      className="text-[10px] text-amber-400 font-bold underline"
                    >
                      Kích hoạt VIP
                    </button>
                  )}
                </div>

                {/* 1. Gender Filter */}
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1.5 font-medium">
                    Giới tính đối phương:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'female', label: 'Chỉ Nữ 👩' },
                      { id: 'male', label: 'Chỉ Nam 👨' },
                      { id: 'other', label: 'Tất cả' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (!isVip) {
                            setShowVipModal(true);
                            return;
                          }
                          setPreferredGender(opt.id);
                        }}
                        className={`py-1.5 rounded-xl text-xs font-semibold border transition ${
                          preferredGender === opt.id
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Age Filter */}
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1.5 font-medium">
                    Độ tuổi mong muốn:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'all', label: 'Tất cả' },
                      { id: '18-22', label: '18 - 22' },
                      { id: '23-28', label: '23 - 28' },
                      { id: '29-35', label: '29 - 35' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (!isVip) {
                            setShowVipModal(true);
                            return;
                          }
                          setAgeRange(opt.id);
                        }}
                        className={`py-1.5 rounded-xl text-xs font-semibold border transition ${
                          ageRange === opt.id
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Region Filter */}
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1.5 font-medium">
                    Khu vực / Tỉnh thành:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: '', label: 'Toàn quốc' },
                      { id: 'Hà Nội', label: 'Hà Nội' },
                      { id: 'TP. Hồ Chí Minh', label: 'TP.HCM' },
                      { id: 'Đà Nẵng', label: 'Đà Nẵng' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (!isVip) {
                            setShowVipModal(true);
                            return;
                          }
                          setPreferredCity(opt.id);
                        }}
                        className={`py-1.5 rounded-xl text-xs font-semibold border transition ${
                          preferredCity === opt.id
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

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

      {/* VIP VIDEO CALL MODAL */}
      {showVipModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowVipModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-amber-500/15 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30">
                <Crown className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Nâng cấp VIP Video Call</h2>
              <p className="text-xs text-slate-400">
                Gọi ngẫu nhiên mặc định hoàn toàn <strong>Miễn phí</strong>. Để chọn lọc riêng người gọi theo <strong>Nữ</strong>, <strong>độ tuổi</strong> và <strong>khu vực</strong>, vui lòng nâng cấp gói VIP!
              </p>
            </div>

            {vipSuccess && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs rounded-xl text-center">
                {vipSuccess}
              </div>
            )}

            <div className="space-y-3">
              {[
                {
                  id: 'vip_1day',
                  title: 'Gói VIP 1 Ngày',
                  desc: 'Trải nghiệm toàn bộ bộ lọc trong 24 giờ',
                  price: '19.000 đ',
                  badge: 'Thử nghiệm',
                },
                {
                  id: 'vip_1month',
                  title: 'Gói VIP 1 Tháng',
                  desc: 'Không giới hạn lọc Nữ, tuổi và khu vực trong 30 ngày',
                  price: '99.000 đ',
                  badge: 'Tiết kiệm 80%',
                  highlight: true,
                },
              ].map((pkg) => (
                <div
                  key={pkg.id}
                  className={`p-4 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                    pkg.highlight
                      ? 'bg-amber-500/10 border-amber-500/60 hover:bg-amber-500/20'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                  onClick={() => void handleUpgradeVip(pkg.id)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{pkg.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                        {pkg.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{pkg.desc}</p>
                  </div>
                  <button
                    disabled={isVipLoading}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 font-bold text-xs text-white shadow transition"
                  >
                    {pkg.price}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              💡 Mô phỏng thanh toán VIP: Bấm vào gói trên để kích hoạt VIP ngay lập tức mà không cần thẻ tín dụng thật!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

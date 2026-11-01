import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  X,
  Compass,
  MapPin,
  Sparkles,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  RefreshCw,
  Sliders,
  Camera,
  Upload,
} from 'lucide-react';
import { useDiscoverStore } from '../../stores/discoverStore.js';
import { connectSocket } from '../../lib/socket.js';
import { api } from '../../lib/api.js';
import type { SwipeResponse } from '@meetcall/shared';

interface QuotaData {
  isUnlocked: boolean;
  photosCount: number;
  requiredPhotos: number;
  freeQuota: number;
  usedSwipes: number;
  purchasedSwipes: number;
  remainingSwipes: number;
}

export function DiscoverPage() {
  const navigate = useNavigate();
  const {
    candidates,
    currentIndex,
    isLoading,
    error,
    newMatch,
    activePhotoIndex,
    fetchCandidates,
    swipe,
    clearNewMatch,
    nextPhoto,
    prevPhoto,
  } = useDiscoverStore();

  const [swipeAnimation, setSwipeAnimation] = useState<'like' | 'pass' | null>(null);
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [isTopupLoading, setIsTopupLoading] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState('');

  const loadQuota = useCallback(async () => {
    try {
      const res = await api<QuotaData>('/swipes/quota');
      setQuota(res);
    } catch {
      // ignore
    }
  }, []);

  // Initialize candidates & socket listener
  useEffect(() => {
    void fetchCandidates();
    void loadQuota();

    const socket = connectSocket();
    const handleMatchNew = (data: { matchId: string; matchedUser: SwipeResponse['matchedUser'] }) => {
      if (data?.matchedUser) {
        useDiscoverStore.setState({
          newMatch: {
            ...data.matchedUser,
            matchId: data.matchId,
          },
        });
      }
    };

    socket.on('match:new', handleMatchNew);
    return () => {
      socket.off('match:new', handleMatchNew);
    };
  }, [fetchCandidates, loadQuota]);

  const handleTopup = async (packageId: string) => {
    try {
      setIsTopupLoading(true);
      const res = await api<{ success: boolean; message: string; quota: QuotaData }>('/swipes/topup', {
        method: 'POST',
        body: JSON.stringify({ packageId }),
      });
      if (res.quota) {
        setQuota(res.quota);
      }
      setTopupSuccess(res.message);
      setTimeout(() => {
        setTopupSuccess('');
        setShowTopupModal(false);
      }, 1500);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Nạp lượt quẹt thất bại');
    } finally {
      setIsTopupLoading(false);
    }
  };

  const handleSwipe = useCallback(
    async (action: 'like' | 'pass') => {
      if (swipeAnimation || isLoading) return;
      if (quota && quota.isUnlocked && quota.remainingSwipes <= 0) {
        setShowTopupModal(true);
        return;
      }

      setSwipeAnimation(action);
      setTimeout(async () => {
        try {
          await swipe(action);
          setQuota((prev) =>
            prev ? { ...prev, remainingSwipes: Math.max(0, prev.remainingSwipes - 1) } : prev,
          );
        } catch (err: any) {
          if (err?.code === 'SWIPE_QUOTA_EXCEEDED') {
            setShowTopupModal(true);
          }
        }
        setSwipeAnimation(null);
      }, 250);
    },
    [swipeAnimation, isLoading, swipe, quota],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (newMatch) return;
      if (e.key === 'ArrowLeft') {
        void handleSwipe('pass');
      } else if (e.key === 'ArrowRight') {
        void handleSwipe('like');
      } else if (e.key === 'ArrowUp') {
        prevPhoto();
      } else if (e.key === 'ArrowDown') {
        nextPhoto();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe, prevPhoto, nextPhoto, newMatch]);

  const currentCandidate = candidates[currentIndex];
  const photos = currentCandidate?.photos || [];
  const currentPhoto = photos[activePhotoIndex] || photos[0];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col select-none">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-rose-500 animate-spin-slow" />
            <h1 className="text-base font-bold">Khám phá</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {quota && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium">
              <span className="text-amber-400">⚡</span>
              {quota.isUnlocked ? (
                <span>
                  Còn <strong className="text-rose-400">{quota.remainingSwipes}</strong> lượt
                </span>
              ) : (
                <span className="text-slate-400">
                  🔒 {quota.photosCount}/3 ảnh
                </span>
              )}
              {quota.isUnlocked && (
                <button
                  type="button"
                  onClick={() => setShowTopupModal(true)}
                  className="ml-1 text-[10px] text-amber-300 font-bold bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded-full transition"
                >
                  + Nạp
                </button>
              )}
            </div>
          )}
          <Link
            to="/settings/profile"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Tuỳ chỉnh tìm kiếm"
          >
            <Sliders className="w-5 h-5" />
          </Link>
          <Link
            to="/matches"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            <MessageCircle className="w-4 h-4 text-rose-400" />
            <span>Tương hợp</span>
          </Link>
        </div>
      </header>

      {/* Main Swipe Playground */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {error && (
          <div className="mb-4 max-w-sm w-full p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs text-center">
            {error}
          </div>
        )}

        {quota && !quota.isUnlocked ? (
          /* 3-Photo Requirement Lock Card */
          <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl backdrop-blur-md">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Mở khóa 20 lượt quẹt miễn phí</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Để hẹn hò hiệu quả và an toàn, MeetCall yêu cầu bạn điền đầy đủ thông tin hồ sơ và tải lên <strong>ít nhất 3 ảnh</strong> để mở khóa 20 lượt quẹt miễn phí.
              </p>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Tiến độ ảnh:</span>
                <span className="font-bold text-rose-400">{quota.photosCount} / 3 ảnh</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-rose-500 to-orange-400 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (quota.photosCount / 3) * 100)}%` }}
                />
              </div>
            </div>

            <Link
              to="/settings/profile"
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 font-bold text-sm text-white shadow-lg shadow-rose-500/25 transition"
            >
              <Upload className="w-4 h-4" />
              <span>Tải ảnh & hoàn tất hồ sơ</span>
            </Link>
          </div>
        ) : isLoading && !currentCandidate ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Đang tìm kiếm hồ sơ quanh bạn...</p>
          </div>
        ) : !currentCandidate ? (
          /* Empty state: No more candidates */
          <div className="max-w-sm w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Bạn đã xem hết hồ sơ!</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Không còn ứng viên nào trong phạm vi tìm kiếm hiện tại của bạn. Bạn có thể mở rộng bán kính tìm kiếm hoặc khoảng tuổi trong cài đặt.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void fetchCandidates()}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tìm kiếm lại</span>
              </button>
              <Link
                to="/settings/profile"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-xs font-semibold text-white transition text-center shadow-md shadow-rose-500/20"
              >
                Mở rộng bán kính tìm kiếm
              </Link>
            </div>
          </div>
        ) : (
          /* Active Candidate Card */
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <div
              className={`relative w-full aspect-[3/4] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-transform duration-200 ${
                swipeAnimation === 'like'
                  ? 'translate-x-24 rotate-12 opacity-0'
                  : swipeAnimation === 'pass'
                  ? '-translate-x-24 -rotate-12 opacity-0'
                  : 'translate-x-0 rotate-0 opacity-100'
              }`}
            >
              {/* Photo */}
              {currentPhoto?.url ? (
                <img
                  src={currentPhoto.url}
                  alt={currentCandidate.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-500 text-sm">
                  Không có ảnh
                </div>
              )}

              {/* Photo indicators */}
              {photos.length > 1 && (
                <div className="absolute top-3 inset-x-3 flex gap-1 z-10">
                  {photos.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        idx === activePhotoIndex ? 'bg-white' : 'bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Click zones for switching photos */}
              {photos.length > 1 && (
                <>
                  <div
                    onClick={prevPhoto}
                    className="absolute left-0 inset-y-0 w-1/3 cursor-pointer z-10 flex items-center pl-2 opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <div className="p-1.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
                      <ChevronLeft className="w-4 h-4" />
                    </div>
                  </div>
                  <div
                    onClick={nextPhoto}
                    className="absolute right-0 inset-y-0 w-1/3 cursor-pointer z-10 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <div className="p-1.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </>
              )}

              {/* Like / Pass stamps during swipe */}
              {swipeAnimation === 'like' && (
                <div className="absolute top-8 left-6 border-4 border-emerald-400 text-emerald-400 font-extrabold text-2xl px-4 py-1 rounded-xl rotate-[-15deg] uppercase tracking-wider z-20">
                  LIKE
                </div>
              )}
              {swipeAnimation === 'pass' && (
                <div className="absolute top-8 right-6 border-4 border-red-500 text-red-500 font-extrabold text-2xl px-4 py-1 rounded-xl rotate-[15deg] uppercase tracking-wider z-20">
                  PASS
                </div>
              )}

              {/* Gradient info overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent flex flex-col justify-end p-5 pointer-events-none">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl font-bold text-white drop-shadow">
                    {currentCandidate.displayName}
                  </h2>
                  <span className="text-xl font-medium text-slate-300 drop-shadow">
                    {currentCandidate.age}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 drop-shadow">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    {currentCandidate.city || 'Chưa cập nhật'} · Cách bạn ~{currentCandidate.distanceKm} km
                  </span>
                </div>

                {currentCandidate.bio && (
                  <p className="text-xs text-slate-200 mt-2.5 line-clamp-2 drop-shadow">
                    {currentCandidate.bio}
                  </p>
                )}

                {currentCandidate.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {currentCandidate.interests.slice(0, 4).map((interest) => (
                      <span
                        key={interest}
                        className="text-[10px] bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-white font-medium"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6 mt-2">
              <button
                type="button"
                onClick={() => void handleSwipe('pass')}
                disabled={Boolean(swipeAnimation)}
                className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 hover:border-red-500/50 hover:bg-red-500/10 text-red-400 shadow-xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 disabled:opacity-50"
                title="Bỏ qua (Phím ←)"
              >
                <X className="w-7 h-7" />
              </button>

              <button
                type="button"
                onClick={() => void handleSwipe('like')}
                disabled={Boolean(swipeAnimation)}
                className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 to-orange-400 text-white shadow-xl shadow-rose-500/25 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 disabled:opacity-50"
                title="Thích (Phím →)"
              >
                <Heart className="w-8 h-8 fill-white" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Dùng phím mũi tên: ← Bỏ qua · → Thích · ↑ ↓ Đổi ảnh
            </p>
          </div>
        )}
      </main>

      {/* IT'S A MATCH CELEBRATION MODAL */}
      {newMatch && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-sm w-full bg-gradient-to-b from-slate-900 to-slate-950 border border-rose-500/30 rounded-3xl p-6 text-center space-y-6 shadow-2xl shadow-rose-500/20">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-300 animate-spin-slow" />
              <h2 className="text-3xl font-extrabold bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
                It&apos;s a Match!
              </h2>
              <Sparkles className="w-6 h-6 text-amber-300 animate-spin-slow" />
            </div>

            <p className="text-xs text-slate-300">
              Bạn và <span className="font-bold text-white">{newMatch.displayName}</span> đã thích lẫn nhau!
            </p>

            {/* Avatar thumbnail */}
            <div className="relative mx-auto w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-rose-500 to-orange-400 shadow-xl shadow-rose-500/30">
              {newMatch.avatar ? (
                <img
                  src={newMatch.avatar}
                  alt={newMatch.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-2xl font-bold text-rose-400">
                  {newMatch.displayName[0]}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  clearNewMatch();
                  navigate('/matches');
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 font-bold text-sm text-white shadow-lg shadow-rose-500/25 transition flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Nhắn tin ngay</span>
              </button>

              <button
                type="button"
                onClick={clearNewMatch}
                className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
              >
                Tiếp tục quẹt thẻ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOPUP SWIPES MODAL */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowTopupModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white">Hết lượt quẹt miễn phí</h2>
              <p className="text-xs text-slate-400">
                Bạn đã sử dụng hết 20 lượt quẹt. Hãy chọn gói nạp để tiếp tục tìm kiếm những người bạn mới!
              </p>
            </div>

            {topupSuccess && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs rounded-xl text-center">
                {topupSuccess}
              </div>
            )}

            <div className="space-y-3">
              {[
                { id: 'swipe_20', title: 'Gói 20 lượt quẹt', price: '20.000 đ', badge: 'Cơ bản' },
                { id: 'swipe_50', title: 'Gói 50 lượt quẹt', price: '45.000 đ', badge: 'Phổ biến', highlight: true },
                { id: 'swipe_100', title: 'Gói 100 lượt quẹt', price: '79.000 đ', badge: 'Tiết kiệm 30%' },
                { id: 'swipe_unlimited', title: 'Gói VIP Không Giới Hạn', price: '149.000 đ / tháng', badge: 'VIP' },
              ].map((pkg) => (
                <div
                  key={pkg.id}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                    pkg.highlight
                      ? 'bg-rose-500/10 border-rose-500/60 hover:bg-rose-500/20'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                  onClick={() => void handleTopup(pkg.id)}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{pkg.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                        {pkg.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Cộng ngay vào tài khoản</p>
                  </div>
                  <button
                    disabled={isTopupLoading}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 font-bold text-xs text-white shadow transition"
                  >
                    {pkg.price}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              💡 Mô phỏng nạp tiền: Bấm vào bất kỳ gói nào trên để được cộng lượt quẹt ngay tức thì!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  Heart,
  MessageCircle,
  Settings,
  Sparkles,
  LogOut,
  MapPin,
  CheckCircle,
} from 'lucide-react';
import type { HealthResponse } from '@meetcall/shared';
import { useAuthStore } from '../../stores/authStore.js';
import { useProfileStore } from '../../stores/profileStore.js';
import { api } from '../../lib/api.js';

export function HomePage() {
  const { user, logout } = useAuthStore();
  const { me, fetchMe } = useProfileStore();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  useEffect(() => {
    void fetchMe();
    api<HealthResponse>('/health')
      .then((data) => {
        setHealth(data);
        setLoadingHealth(false);
      })
      .catch(() => {
        setLoadingHealth(false);
      });
  }, [fetchMe]);

  const handleLogout = async () => {
    await logout();
  };

  const [avatarError, setAvatarError] = useState(false);
  const [bannerAvatarError, setBannerAvatarError] = useState(false);

  const rawPhoto = me?.photos?.[0]?.url;
  const mainPhoto = rawPhoto ? rawPhoto.replace(/^http:\/\/localhost:3000/, '') : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-orange-400 p-0.5 shadow-md shadow-rose-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-rose-400 to-orange-300 bg-clip-text text-transparent">
              MeetCall
            </h1>
            <p className="text-[11px] text-slate-400">Dating & Video Call</p>
          </div>
        </div>

        {/* Center / Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-1">
          <Link
            to="/discover"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 transition"
          >
            <Compass className="w-4 h-4" />
            <span>Khám phá</span>
          </Link>
          <Link
            to="/matches"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Tương hợp & Chat</span>
          </Link>
          <Link
            to="/settings/profile"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          >
            <Settings className="w-4 h-4" />
            <span>Hồ sơ</span>
          </Link>
        </nav>

        {/* User Status & Action */}
        <div className="flex items-center gap-3">
          <Link
            to="/settings/profile"
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-800/60 transition"
          >
            {mainPhoto && !avatarError ? (
              <img
                src={mainPhoto}
                alt="Avatar"
                onError={() => setAvatarError(true)}
                className="w-8 h-8 rounded-full object-cover border border-rose-500/40"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-rose-400">
                {(me?.profile.displayName || user?.email || 'U')[0]?.toUpperCase()}
              </div>
            )}
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-200">
                {me?.profile.displayName || user?.email?.split('@')[0]}
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-2.5 h-2.5" />
                18+ Đã xác thực
              </span>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/60 rounded-xl transition"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Profile overview banner */}
        <div className="p-6 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-slate-800 rounded-3xl shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {mainPhoto && !bannerAvatarError ? (
                <img
                  src={mainPhoto}
                  alt="Avatar"
                  onError={() => setBannerAvatarError(true)}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-rose-500 shadow-md shadow-rose-500/20"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center text-xl font-bold text-rose-400">
                  {me?.profile.displayName?.[0] || 'U'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">
                    {me?.profile.displayName || 'Chào bạn'}
                  </h2>
                  <span className="px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-full text-[10px] font-bold">
                    {me?.profile.gender === 'male' ? 'Nam' : me?.profile.gender === 'female' ? 'Nữ' : 'Khác'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>{me?.profile.city || 'Chưa cập nhật thành phố'}</span>
                  {me?.profile.bio && <span className="mx-1">·</span>}
                  <span className="line-clamp-1">{me?.profile.bio}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/settings/profile"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition border border-slate-700"
              >
                Chỉnh sửa hồ sơ
              </Link>
              <Link
                to="/discover"
                className="px-4 py-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-xs font-semibold text-white rounded-xl shadow-md shadow-rose-500/20 transition flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Khám phá ngay</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Feature quick links grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/discover"
            className="p-5 bg-slate-900/60 border border-slate-800/80 hover:border-rose-500/40 rounded-2xl transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Vuốt thẻ hẹn hò</h3>
            <p className="text-xs text-slate-400">
              Khám phá hồ sơ theo khoảng cách và độ tuổi, thích hoặc bỏ qua.
            </p>
          </Link>

          <Link
            to="/matches"
            className="p-5 bg-slate-900/60 border border-slate-800/80 hover:border-orange-500/40 rounded-2xl transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Tương hợp & Nhắn tin</h3>
            <p className="text-xs text-slate-400">
              Trò chuyện realtime, nhận biết đã xem và trạng thái trực tuyến.
            </p>
          </Link>

          <Link
            to="/random"
            className="p-5 bg-slate-900/60 border border-slate-800/80 hover:border-purple-500/40 rounded-2xl transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Video Call ngẫu nhiên</h3>
            <p className="text-xs text-slate-400">
              Kết nối trực tiếp 1-1 với những người dùng 18+ đã được kiểm duyệt.
            </p>
          </Link>
        </div>

        {/* Backend Infrastructure Check card */}
        <div className="p-5 bg-slate-900/40 border border-slate-800/70 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Trạng thái hệ thống (MeetCall Backend)
            </h3>
            {loadingHealth ? (
              <span className="text-xs text-slate-500">Đang kiểm tra...</span>
            ) : health?.status === 'ok' ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Hoạt động bình thường
              </span>
            ) : (
              <span className="text-xs text-red-400 font-medium">Lỗi kết nối</span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block text-[10px]">PostgreSQL 16 + PostGIS</span>
              <span className="font-semibold text-slate-200 mt-1 block">
                {health?.services?.postgres ? '✅ Sẵn sàng' : '❌ Mất kết nối'}
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block text-[10px]">Redis 7 (Cache & BullMQ)</span>
              <span className="font-semibold text-slate-200 mt-1 block">
                {health?.services?.redis ? '✅ Sẵn sàng' : '❌ Mất kết nối'}
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block text-[10px]">Ảnh & Kiểm duyệt</span>
              <span className="font-semibold text-slate-200 mt-1 block">
                {me?.photos?.length ? `✅ ${me.photos.length} ảnh` : 'Chưa có ảnh'}
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block text-[10px]">Onboarding</span>
              <span className="font-semibold text-emerald-400 mt-1 block">
                {me?.onboardingCompleted ? '✅ Đã hoàn tất' : '⚠️ Chưa hoàn tất'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

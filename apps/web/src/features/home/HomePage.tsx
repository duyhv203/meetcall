import { useEffect, useState } from 'react';
import type { HealthResponse } from '@meetcall/shared';
import { useAuthStore } from '../../stores/authStore.js';
import { api } from '../../lib/api.js';

export function HomePage() {
  const { user, logout } = useAuthStore();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  useEffect(() => {
    api<HealthResponse>('/health')
      .then((data) => {
        setHealth(data);
        setLoadingHealth(false);
      })
      .catch(() => {
        setLoadingHealth(false);
      });
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">
              MeetCall
            </h1>
            <p className="text-xs text-slate-400">Dating & Video Call</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium text-slate-200">{user?.email}</span>
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Đã xác thực 18+
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="py-2 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Xin chào, <span className="text-rose-400">{user?.email}</span>!
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Tài khoản của bạn đã được xác thực an toàn. Các tính năng hẹn hò & gọi video đang sẵn sàng theo từng bước kế hoạch.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full text-xs font-semibold">
                Role: {user?.role.toUpperCase()}
              </span>
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-semibold">
                Status: {user?.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Backend Health Check card */}
        <div className="p-6 bg-slate-900/50 border border-slate-800/80 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Trạng thái dịch vụ nền (Backend Infrastructure)
            </h3>
            {health?.status === 'ok' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            )}
          </div>

          {loadingHealth ? (
            <p className="text-xs text-slate-400">Đang kiểm tra kết nối dịch vụ...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-slate-400">PostgreSQL + PostGIS</span>
                <span className={health?.services?.postgres ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
                  {health?.services?.postgres ? 'Online' : 'Offline'}
                </span>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-slate-400">Redis (Cache / Presence / Queue)</span>
                <span className={health?.services?.redis ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
                  {health?.services?.redis ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

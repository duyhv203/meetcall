import { useEffect, useState } from 'react';
import type { HealthResponse } from '@meetcall/shared';

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json() as Promise<HealthResponse>;
      })
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <div className="w-full max-w-md p-8 bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/60 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 mb-4 border border-rose-500/30">
          <svg
            className="w-8 h-8"
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

        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
          MeetCall
        </h1>
        <p className="text-sm text-slate-400 mt-1">Dating & Real-Time Video Call Platform</p>

        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Hệ thống & Dịch vụ (Backend Health)
          </h2>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-slate-400 py-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span>Đang kiểm tra kết nối API...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/40 rounded-lg text-red-200 text-sm">
              <p className="font-medium">Không thể kết nối đến Backend</p>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>
          )}

          {health && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900/70 border border-slate-700 rounded-lg">
                <span className="text-sm font-medium text-slate-300">Trạng thái API</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {health.status.toUpperCase()}
                </span>
              </div>

              {health.services && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-900/40 border border-slate-700/60 rounded-md flex items-center justify-between">
                    <span className="text-slate-400">Postgres + PostGIS</span>
                    <span
                      className={
                        health.services.postgres ? 'text-emerald-400 font-semibold' : 'text-red-400'
                      }
                    >
                      {health.services.postgres ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900/40 border border-slate-700/60 rounded-md flex items-center justify-between">
                    <span className="text-slate-400">Redis Cache</span>
                    <span
                      className={
                        health.services.redis ? 'text-emerald-400 font-semibold' : 'text-red-400'
                      }
                    >
                      {health.services.redis ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default App;

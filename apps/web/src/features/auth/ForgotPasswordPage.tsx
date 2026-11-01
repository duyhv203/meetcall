import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AuthSuccessMessage } from '@meetcall/shared';
import { api } from '../../lib/api.js';
import { getErrorMessage } from '../../lib/errorMessages.js';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api<AuthSuccessMessage>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSuccessMessage(
        res.message || 'Nếu email tồn tại trong hệ thống, hướng dẫn đã được gửi đến bạn.',
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <div className="w-full max-w-md p-8 bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 mb-3 border border-amber-500/30">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-rose-400 bg-clip-text text-transparent">
            Quên mật khẩu?
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Nhập email của bạn để nhận liên kết khôi phục mật khẩu
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm flex items-start gap-2">
            <span className="text-red-400 font-bold">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {successMessage ? (
          <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-center space-y-3">
            <div className="text-emerald-400 text-3xl">✉️</div>
            <p className="text-sm text-emerald-200">{successMessage}</p>
            <p className="text-xs text-slate-400">
              Trong môi trường phát triển (Dev), hãy mở{' '}
              <a
                href="http://localhost:8025"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 underline font-semibold"
              >
                Mailpit (localhost:8025)
              </a>{' '}
              để xem email giả lập.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-block py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
              >
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Email đã đăng ký
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenban@example.com"
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm text-white placeholder-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 rounded-lg font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{loading ? 'Đang gửi yêu cầu...' : 'Gửi liên kết đặt lại'}</span>
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-xs text-slate-400 hover:text-slate-300 underline"
              >
                Nhớ mật khẩu rồi? Đăng nhập ngay
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

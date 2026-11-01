import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AuthResponse } from '@meetcall/shared';
import { api } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { getErrorMessage } from '../../lib/errorMessages.js';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAgeConfirmed) {
      setError('Bạn phải xác nhận đã đủ 18 tuổi trở lên để tiếp tục.');
      return;
    }

    if (!isTermsAccepted) {
      setError('Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư.');
      return;
    }

    if (password.length < 10) {
      setError('Mật khẩu phải có tối thiểu 10 ký tự.');
      return;
    }

    setLoading(true);

    try {
      const response = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          birthdate,
        }),
      });

      setAuth(response.user, response.accessToken);
      navigate('/');
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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 mb-3 border border-rose-500/30">
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
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">
            Tạo tài khoản MeetCall
          </h1>
          <p className="text-sm text-slate-400 mt-1">Bắt đầu kết nối và hẹn hò qua video call</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm flex items-start gap-2">
            <span className="text-red-400 font-bold">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenban@example.com"
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Mật khẩu (tối thiểu 10 ký tự)
            </label>
            <input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Ngày sinh (yêu cầu từ 18 tuổi trở lên)
            </label>
            <input
              type="date"
              required
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm text-white"
            />
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isAgeConfirmed}
                onChange={(e) => setIsAgeConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500"
              />
              <span>Tôi xác nhận và cam kết đã đủ 18 tuổi trở lên.</span>
            </label>

            <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isTermsAccepted}
                onChange={(e) => setIsTermsAccepted(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500"
              />
              <span>
                Tôi đồng ý với <span className="text-rose-400 underline">Điều khoản dịch vụ</span>{' '}
                và <span className="text-rose-400 underline">Chính sách quyền riêng tư</span>.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 rounded-lg font-semibold text-sm shadow-lg shadow-rose-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <span>{loading ? 'Đang tạo tài khoản...' : 'Đăng ký ngay'}</span>
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-rose-400 hover:text-rose-300 font-semibold underline">
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}

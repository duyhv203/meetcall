import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import type { ExportDataResponse } from '@meetcall/shared';

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setPushEnabled(true);
    }
  }, []);

  const handleTogglePush = async () => {
    if (!('Notification' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ thông báo đẩy.');
      return;
    }

    setPushLoading(true);
    try {
      if (!pushEnabled) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Register dummy/VAPID token for device registration
          const token = `web_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await fetch('/api/v1/me/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fcmToken: token, platform: 'web' }),
          });
          localStorage.setItem('meetcall_device_token', token);
          setPushEnabled(true);
        } else {
          alert('Bạn đã từ chối cấp quyền thông báo đẩy trong trình duyệt.');
        }
      } else {
        const savedToken = localStorage.getItem('meetcall_device_token');
        if (savedToken) {
          await fetch('/api/v1/me/devices', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fcmToken: savedToken }),
          });
          localStorage.removeItem('meetcall_device_token');
        }
        setPushEnabled(false);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi cài đặt thông báo');
    } finally {
      setPushLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/v1/me/export');
      if (!res.ok) throw new Error('Không thể xuất dữ liệu');
      const data: ExportDataResponse = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meetcall-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi tải tệp dữ liệu');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/v1/me', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Không thể xoá tài khoản');
      alert('Tài khoản của bạn đã được đánh dấu xoá và sẽ bị xoá vĩnh viễn sau 7 ngày.');
      await logout();
      navigate('/login');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi xoá tài khoản');
    } finally {
      setDeleteLoading(false);
      setDeleteModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/"
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            ←
          </Link>
          <h1 className="text-2xl font-bold text-white">Cài đặt tài khoản</h1>
        </div>

        <div className="space-y-6">
          {/* Section 1: Notifications */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
              <span>🔔</span> Thông báo đẩy (Web Push)
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Nhận thông báo ngay khi có tương hợp mới, tin nhắn mới, hoặc cuộc gọi đến.
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <div>
                <p className="text-sm font-medium text-slate-200">Bật thông báo trên thiết bị</p>
                <p className="text-xs text-slate-500">
                  {pushEnabled ? 'Đang bật' : 'Đang tắt'}
                </p>
              </div>
              <button
                onClick={handleTogglePush}
                disabled={pushLoading}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  pushEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {pushLoading ? 'Đang xử lý...' : pushEnabled ? 'Đang bật ✓' : 'Bật thông báo'}
              </button>
            </div>
          </div>

          {/* Section 2: Privacy & Safety */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
              <span>🛡️</span> Quyền riêng tư & An toàn
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Quản lý danh sách chặn, xem lại các điều khoản pháp lý và bảo vệ dữ liệu.
            </p>

            <div className="space-y-2">
              <Link
                to="/settings/blocked"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 transition text-sm text-slate-200"
              >
                <span>Danh sách người dùng đã chặn</span>
                <span className="text-slate-500">→</span>
              </Link>
              <Link
                to="/terms"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 transition text-sm text-slate-200"
              >
                <span>Điều khoản dịch vụ 18+ (Terms of Service)</span>
                <span className="text-slate-500">→</span>
              </Link>
              <Link
                to="/privacy"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 transition text-sm text-slate-200"
              >
                <span>Chính sách quyền riêng tư (Privacy Policy & GDPR)</span>
                <span className="text-slate-500">→</span>
              </Link>
            </div>
          </div>

          {/* Section 3: GDPR Data Portability */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
              <span>📦</span> Xuất dữ liệu cá nhân (GDPR)
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Theo quy định GDPR và bảo vệ dữ liệu cá nhân, bạn có quyền tải về bản sao toàn bộ hồ sơ, ảnh, tin nhắn, và nhật ký hoạt động của mình dưới định dạng JSON.
            </p>

            <button
              onClick={handleExportData}
              disabled={exportLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-semibold text-white transition disabled:opacity-50 flex items-center gap-2"
            >
              <span>{exportLoading ? 'Đang trích xuất dữ liệu...' : 'Tải xuống dữ liệu của tôi (.json)'}</span>
            </button>
          </div>

          {/* Section 4: Danger Zone */}
          <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-rose-400 mb-1 flex items-center gap-2">
              <span>⚠️</span> Vùng nguy hiểm
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Khi xoá tài khoản, tài khoản của bạn sẽ lập tức bị khoá và ẩn khỏi hệ thống. Toàn bộ dữ liệu sẽ được xoá vĩnh viễn sau 7 ngày.
            </p>

            <button
              onClick={() => setDeleteModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition shadow-lg shadow-rose-900/30"
            >
              Xoá tài khoản vĩnh viễn
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              🗑️
            </div>
            <h3 className="text-base font-bold text-white text-center mb-2">
              Xác nhận xoá tài khoản?
            </h3>
            <p className="text-xs text-slate-400 text-center mb-6 leading-relaxed">
              Hành động này sẽ huỷ bỏ toàn bộ tương hợp, tin nhắn và phiên đăng nhập. Tài khoản của bạn sẽ bị xoá vĩnh viễn sau thời gian ân hạn 7 ngày.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Giữ lại tài khoản
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50"
              >
                {deleteLoading ? 'Đang xử lý...' : 'Xác nhận Xoá'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

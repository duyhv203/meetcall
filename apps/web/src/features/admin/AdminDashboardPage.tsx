import { useEffect, useState } from 'react';
import type { AdminReportItem } from '@meetcall/shared';

interface AdminPhoto {
  id: string;
  userId: string;
  url: string;
  position: number;
  moderationStatus: string;
  createdAt: string;
  user: {
    email: string;
    displayName: string;
  };
}

export const AdminDashboardPage = () => {
  const [activeTab, setActiveTab] = useState<'reports' | 'photos' | 'users'>('reports');

  // Reports state
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportActionLoading, setReportActionLoading] = useState<string | null>(null);

  // Photos state
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoActionLoading, setPhotoActionLoading] = useState<string | null>(null);

  // User management state
  const [targetUserId, setTargetUserId] = useState('');
  const [userActionNote, setUserActionNote] = useState('');
  const [userActionMsg, setUserActionMsg] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/v1/admin/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const res = await fetch('/api/v1/admin/photos?status=pending');
      if (res.ok) {
        const data = await res.json();
        setPhotos(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPhotos(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'photos') fetchPhotos();
  }, [activeTab]);

  const handleResolveReport = async (
    reportId: string,
    action: 'dismiss' | 'warn' | 'suspend' | 'ban',
  ) => {
    setReportActionLoading(reportId);
    try {
      const res = await fetch(`/api/v1/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: `Admin chọn hành động ${action}` }),
      });
      if (res.ok) {
        await fetchReports();
      } else {
        const err = await res.json();
        alert(err?.error?.message || 'Xử lý báo cáo thất bại');
      }
    } finally {
      setReportActionLoading(null);
    }
  };

  const handleModeratePhoto = async (photoId: string, status: 'approved' | 'rejected') => {
    setPhotoActionLoading(photoId);
    try {
      const res = await fetch(`/api/v1/admin/photos/${photoId}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      }
    } finally {
      setPhotoActionLoading(null);
    }
  };

  const handleSuspendUser = async (suspend: boolean) => {
    if (!targetUserId.trim()) return;
    setUserActionMsg('Đang xử lý...');
    try {
      const res = await fetch(`/api/v1/admin/users/${targetUserId.trim()}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspend, note: userActionNote.trim() || undefined }),
      });
      if (res.ok) {
        setUserActionMsg(`Thành công: Đã ${suspend ? 'khoá' : 'mở khoá'} tài khoản ${targetUserId}`);
        setTargetUserId('');
        setUserActionNote('');
      } else {
        const err = await res.json();
        setUserActionMsg(`Lỗi: ${err?.error?.message || 'Không thể cập nhật người dùng'}`);
      }
    } catch (e: unknown) {
      setUserActionMsg(e instanceof Error ? e.message : 'Lỗi mạng');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 mb-8 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 text-xs font-bold rounded-lg border border-rose-500/30">
                ADMIN
              </span>
              <h1 className="text-2xl font-bold text-white">Trung tâm Quản trị MeetCall</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Kiểm duyệt nội dung, xử lý báo cáo vi phạm, và bảo vệ an toàn cộng đồng 18+.
            </p>
          </div>

          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'reports' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Báo cáo vi phạm ({reports.filter((r) => r.status === 'open').length})
            </button>
            <button
              onClick={() => setActiveTab('photos')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'photos' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Kiểm duyệt ảnh ({photos.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'users' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Quản lý tài khoản
            </button>
          </div>
        </div>

        {/* Tab 1: Reports */}
        {activeTab === 'reports' && (
          <div>
            {loadingReports ? (
              <div className="text-center py-12 text-slate-500 text-sm">Đang tải báo cáo...</div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="text-4xl mb-3">🛡️</div>
                <h3 className="text-lg font-semibold text-slate-200">Không có báo cáo nào</h3>
                <p className="text-xs text-slate-400 mt-1">Hệ thống đang hoạt động an toàn và sạch sẽ.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((r) => {
                  const isUrgent = r.priority === 'urgent';
                  return (
                    <div
                      key={r.id}
                      className={`p-5 rounded-2xl border transition ${
                        isUrgent
                          ? 'bg-rose-950/20 border-rose-500/50'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          {isUrgent && (
                            <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-extrabold uppercase rounded animate-pulse">
                              KHẨN CẤP: DƯỚI 18T
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] uppercase rounded font-bold">
                            Lý do: {r.reason}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] uppercase rounded font-bold ${
                              r.status === 'open'
                                ? 'bg-amber-500/20 text-amber-400'
                                : r.status === 'actioned'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {new Date(r.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-950/60 p-3 rounded-xl mb-3">
                        <div>
                          <p className="text-slate-400">Người báo cáo:</p>
                          <p className="font-semibold text-white">
                            {r.reporter.displayName} ({r.reporter.email})
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Đối tượng bị báo cáo:</p>
                          <p className="font-semibold text-white">
                            {r.target.displayName} ({r.target.email})
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Trạng thái: {r.target.status}{' '}
                            {r.target.randomBannedUntil && `(Khoá random đến ${new Date(r.target.randomBannedUntil).toLocaleDateString('vi-VN')})`}
                          </p>
                        </div>
                      </div>

                      {r.details && (
                        <div className="text-xs text-slate-300 mb-4 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                          <span className="text-slate-500 block mb-0.5">Chi tiết:</span>
                          {r.details}
                        </div>
                      )}

                      {r.status === 'open' && (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                          <button
                            onClick={() => handleResolveReport(r.id, 'dismiss')}
                            disabled={reportActionLoading === r.id}
                            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:text-white hover:border-slate-500"
                          >
                            Bỏ qua (Dismiss)
                          </button>
                          <button
                            onClick={() => handleResolveReport(r.id, 'warn')}
                            disabled={reportActionLoading === r.id}
                            className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-xs text-amber-400 hover:bg-amber-500/10"
                          >
                            Cảnh cáo (Warn)
                          </button>
                          <button
                            onClick={() => handleResolveReport(r.id, 'suspend')}
                            disabled={reportActionLoading === r.id}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                          >
                            Khoá tài khoản (Suspend)
                          </button>
                          <button
                            onClick={() => handleResolveReport(r.id, 'ban')}
                            disabled={reportActionLoading === r.id}
                            className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-xs font-semibold text-white"
                          >
                            Cấm vĩnh viễn (Ban)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Photos */}
        {activeTab === 'photos' && (
          <div>
            {loadingPhotos ? (
              <div className="text-center py-12 text-slate-500 text-sm">Đang tải ảnh...</div>
            ) : photos.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="text-4xl mb-3">📸</div>
                <h3 className="text-lg font-semibold text-slate-200">Không có ảnh cần duyệt</h3>
                <p className="text-xs text-slate-400 mt-1">Toàn bộ ảnh đã được xử lý.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col"
                  >
                    <div className="h-64 bg-slate-950 relative">
                      <img
                        src={p.url}
                        alt="Moderation candidate"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-white truncate">
                          {p.user.displayName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{p.user.email}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleModeratePhoto(p.id, 'rejected')}
                          disabled={photoActionLoading === p.id}
                          className="py-1.5 rounded-xl border border-rose-500/40 text-xs text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          Từ chối
                        </button>
                        <button
                          onClick={() => handleModeratePhoto(p.id, 'approved')}
                          disabled={photoActionLoading === p.id}
                          className="py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition"
                        >
                          Duyệt
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Users */}
        {activeTab === 'users' && (
          <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-2">Đình chỉ hoặc Mở khoá Tài khoản</h3>
            <p className="text-xs text-slate-400 mb-6">
              Nhập mã User ID để thực hiện hành động quản trị trực tiếp.
            </p>

            {userActionMsg && (
              <div className="mb-4 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200">
                {userActionMsg}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Mã Người dùng (UUID)
                </label>
                <input
                  type="text"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Ghi chú lý do
                </label>
                <input
                  type="text"
                  value={userActionNote}
                  onChange={(e) => setUserActionNote(e.target.value)}
                  placeholder="e.g. Vi phạm điều khoản cộng đồng nhiều lần"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSuspendUser(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-500"
                >
                  Mở khoá tài khoản
                </button>
                <button
                  type="button"
                  onClick={() => handleSuspendUser(true)}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                >
                  Khoá tài khoản
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

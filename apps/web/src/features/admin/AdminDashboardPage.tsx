import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle,
  Eye,
  FileText,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Unlock,
  UserCheck,
  Users,
} from 'lucide-react';
import type {
  AdminActionLogItem,
  AdminReportItem,
  AdminStatsResponse,
  AdminUserItem,
} from '@meetcall/shared';
import { useAuthStore } from '../../stores/authStore.js';

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
  const navigate = useNavigate();
  const { user: currentAdmin, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'reports' | 'photos' | 'logs'>(
    'stats',
  );

  // Stats state
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Users state
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userAgeFilter, setUserAgeFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserItem | null>(null);
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);

  // Reports state
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [reportFilter, setReportFilter] = useState<'all' | 'open' | 'reviewed' | 'actioned'>('open');
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportActionLoading, setReportActionLoading] = useState<string | null>(null);

  // Photos state
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [photoFilter, setPhotoFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoActionLoading, setPhotoActionLoading] = useState<string | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  // Logs state
  const [logs, setLogs] = useState<AdminActionLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch functions
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/v1/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({
        page: userPage.toString(),
        limit: '15',
        search: userSearch.trim(),
        status: userStatusFilter,
        role: userRoleFilter,
        ageVerified: userAgeFilter,
      });
      const res = await fetch(`/api/v1/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUserTotalPages(data.totalPages || 1);
      }
    } catch {
      // ignore
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const url =
        reportFilter === 'all'
          ? '/api/v1/admin/reports'
          : `/api/v1/admin/reports?status=${reportFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReports(data || []);
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
      const res = await fetch(`/api/v1/admin/photos?status=${photoFilter}`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPhotos(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/v1/admin/logs?limit=50');
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingLogs(false);
    }
  };

  // Lifecycle
  useEffect(() => {
    if (activeTab === 'stats') fetchStats();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'photos') fetchPhotos();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'users') {
      const timer = setTimeout(() => {
        fetchUsers();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [userSearch, userStatusFilter, userRoleFilter, userAgeFilter, userPage]);

  useEffect(() => {
    if (activeTab === 'reports') fetchReports();
  }, [reportFilter]);

  useEffect(() => {
    if (activeTab === 'photos') fetchPhotos();
  }, [photoFilter]);

  // Actions
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleToggleSuspendUser = async (user: AdminUserItem) => {
    const isSuspending = user.status !== 'suspended';
    const confirmMsg = isSuspending
      ? `Bạn có chắc chắn muốn KHOÁ tài khoản ${user.email}?`
      : `Bạn có muốn MỞ KHOÁ tài khoản ${user.email}?`;
    if (!window.confirm(confirmMsg)) return;

    setUserActionLoading(user.id);
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspend: isSuspending,
          note: isSuspending ? 'Admin đình chỉ từ bảng người dùng' : 'Admin mở khoá tài khoản',
        }),
      });
      if (res.ok) {
        await fetchUsers();
        if (selectedUserDetail?.id === user.id) {
          setSelectedUserDetail((prev) =>
            prev ? { ...prev, status: isSuspending ? 'suspended' : 'active' } : null,
          );
        }
      } else {
        const err = await res.json();
        alert(err?.error?.message || err?.message || 'Thao tác thất bại');
      }
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleToggleVerifyAge = async (user: AdminUserItem) => {
    const nextVal = !user.ageVerified;
    setUserActionLoading(user.id);
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}/verify-age`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ageVerified: nextVal }),
      });
      if (res.ok) {
        await fetchUsers();
        if (selectedUserDetail?.id === user.id) {
          setSelectedUserDetail((prev) => (prev ? { ...prev, ageVerified: nextVal } : null));
        }
      } else {
        const err = await res.json();
        alert(err?.error?.message || err?.message || 'Cập nhật thất bại');
      }
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleToggleRole = async (user: AdminUserItem) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmMsg =
      nextRole === 'admin'
        ? `Cấp quyền ADMIN cho ${user.email}?`
        : `Hạ quyền ADMIN của ${user.email} xuống thành người dùng thường?`;
    if (!window.confirm(confirmMsg)) return;

    setUserActionLoading(user.id);
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });
      if (res.ok) {
        await fetchUsers();
        if (selectedUserDetail?.id === user.id) {
          setSelectedUserDetail((prev) => (prev ? { ...prev, role: nextRole } : null));
        }
      } else {
        const err = await res.json();
        alert(err?.error?.message || err?.message || 'Cập nhật quyền thất bại');
      }
    } finally {
      setUserActionLoading(null);
    }
  };

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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 md:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-rose-600/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">MeetCall Control Center</h1>
                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-extrabold uppercase rounded border border-rose-500/30">
                  QUẢN TRỊ VIÊN
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Hệ thống Quản lý Người dùng, Kiểm duyệt An toàn và Giám sát Hoạt động
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* System Status Indicator */}
            {stats && (
              <div className="hidden sm:flex items-center gap-3 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      stats.system.postgres === 'healthy' ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                  PostgreSQL
                </span>
                <span className="text-slate-700">|</span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      stats.system.redis === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                    }`}
                  />
                  Redis
                </span>
              </div>
            )}

            <div className="text-right hidden md:block">
              <p className="text-xs font-semibold text-white truncate max-w-[180px]">
                {currentAdmin?.email}
              </p>
              <p className="text-[10px] text-rose-400">Quyền Hạn Toàn Diện</p>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 rounded-xl text-xs font-medium text-slate-300 transition"
              title="Đăng xuất tài khoản quản trị"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto no-scrollbar bg-slate-900 border border-slate-800 rounded-2xl p-1.5 mb-8 gap-1.5">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'stats'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Tổng quan & Thống kê</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Quản lý Người dùng</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'reports'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Báo cáo Vi phạm</span>
            {stats && stats.safety.openReports > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full ml-0.5">
                {stats.safety.openReports}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'photos'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Kiểm duyệt Ảnh</span>
            {stats && stats.safety.pendingPhotos > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-black rounded-full ml-0.5">
                {stats.safety.pendingPhotos}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'logs'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Nhật ký Quản trị</span>
          </button>
        </div>

        {/* TAB 1: STATS & OVERVIEW */}
        {activeTab === 'stats' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Chỉ số Hoạt động Hệ thống</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tổng hợp số liệu người dùng, tương tác hẹn hò, cuộc gọi video và an ninh
                </p>
              </div>
              <button
                onClick={fetchStats}
                disabled={loadingStats}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
                <span>Làm mới số liệu</span>
              </button>
            </div>

            {loadingStats && !stats ? (
              <div className="py-20 text-center text-slate-500 text-sm">
                Đang tải dữ liệu thống kê...
              </div>
            ) : !stats ? (
              <div className="py-20 text-center text-slate-500 text-sm">
                Không thể tải thống kê. Vui lòng bấm làm mới.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Section 1: User metrics */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Người dùng & Tài khoản
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-slate-400 mb-1">Tổng người dùng</p>
                      <p className="text-2xl font-black text-white">{stats.users.total}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-emerald-400 mb-1">Đang hoạt động</p>
                      <p className="text-2xl font-black text-emerald-400">{stats.users.active}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-rose-400 mb-1">Đang bị khoá</p>
                      <p className="text-2xl font-black text-rose-400">{stats.users.suspended}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-cyan-400 mb-1">Đã xác minh 18+</p>
                      <p className="text-2xl font-black text-cyan-400">{stats.users.ageVerified}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-amber-400 mb-1">Quản trị viên (Admin)</p>
                      <p className="text-2xl font-black text-amber-400">{stats.users.admins}</p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Dating & Video Call Metrics */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Tương tác Hẹn hò & Video Call
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-slate-400 mb-1">Tổng lượt tương hợp (Matches)</p>
                      <p className="text-2xl font-black text-pink-400">{stats.activity.totalMatches}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-slate-400 mb-1">Tổng tin nhắn chat</p>
                      <p className="text-2xl font-black text-indigo-400">{stats.activity.totalMessages}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-slate-400 mb-1">Tổng cuộc gọi video</p>
                      <p className="text-2xl font-black text-violet-400">{stats.activity.totalCalls}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-slate-400 mb-1">Cuộc gọi kết nối thành công</p>
                      <p className="text-2xl font-black text-emerald-400">{stats.activity.completedCalls}</p>
                    </div>
                  </div>
                </div>

                {/* Section 3: Safety & Moderation */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    An toàn & Kiểm duyệt
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div
                      className={`p-4 rounded-2xl border transition ${
                        stats.safety.urgentReports > 0
                          ? 'bg-rose-950/40 border-rose-500/80 animate-pulse'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <p className="text-xs text-rose-400 font-bold mb-1">🚨 Báo cáo Khẩn cấp (18-)</p>
                      <p className="text-2xl font-black text-rose-500">{stats.safety.urgentReports}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-amber-400 mb-1">Báo cáo đang chờ xử lý</p>
                      <p className="text-2xl font-black text-amber-400">{stats.safety.openReports}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-yellow-400 mb-1">Ảnh chờ kiểm duyệt</p>
                      <p className="text-2xl font-black text-yellow-400">{stats.safety.pendingPhotos}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <p className="text-xs text-slate-400 mb-1">Tổng ảnh trên hệ thống</p>
                      <p className="text-2xl font-black text-slate-200">{stats.safety.totalPhotos}</p>
                    </div>
                  </div>
                </div>

                {/* Section 4: System health */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Hạ tầng & Trạng thái Máy chủ
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Cơ sở dữ liệu PostgreSQL 16:</span>
                      <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Hoạt động bình thường
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Bộ nhớ đệm Redis & BullMQ:</span>
                      <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Kết nối sẵn sàng
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Thời gian chạy máy chủ (Uptime):</span>
                      <span className="font-mono text-slate-200">
                        {Math.floor(stats.system.uptimeSeconds / 60)} phút (
                        {stats.system.uptimeSeconds}s)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USERS MANAGEMENT */}
        {activeTab === 'users' && (
          <div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Quản lý Tài khoản Người dùng</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tìm kiếm, xem hồ sơ, kiểm duyệt độ tuổi 18+, đình chỉ hoặc phân quyền quản trị
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                {/* Search */}
                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                    placeholder="Tìm email hoặc tên..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Filters */}
                <select
                  value={userStatusFilter}
                  onChange={(e) => {
                    setUserStatusFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="all">Mọi trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="suspended">Bị khoá (Suspended)</option>
                </select>

                <select
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="all">Mọi vai trò</option>
                  <option value="user">Người dùng (User)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>

                <select
                  value={userAgeFilter}
                  onChange={(e) => {
                    setUserAgeFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="all">Mọi độ tuổi</option>
                  <option value="verified">Đã xác minh 18+</option>
                  <option value="unverified">Chưa xác minh</option>
                </select>
              </div>
            </div>

            {loadingUsers ? (
              <div className="py-20 text-center text-slate-500 text-sm">Đang tải danh sách người dùng...</div>
            ) : users.length === 0 ? (
              <div className="py-16 text-center bg-slate-900/50 border border-slate-800 rounded-2xl">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-300 font-semibold">Không tìm thấy tài khoản nào</p>
                <p className="text-xs text-slate-500 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Người dùng</th>
                      <th className="py-3 px-3">Vai trò</th>
                      <th className="py-3 px-3">Thông tin</th>
                      <th className="py-3 px-3">Xác minh 18+</th>
                      <th className="py-3 px-3">Trạng thái</th>
                      <th className="py-3 px-3">Ngày tạo</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {users.map((u) => {
                      const isSuspended = u.status === 'suspended';
                      const isAdmin = u.role === 'admin';
                      return (
                        <tr key={u.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {u.profile?.avatarUrl ? (
                                <img
                                  src={u.profile.avatarUrl}
                                  alt={u.profile.displayName}
                                  className="w-9 h-9 rounded-full object-cover border border-slate-700"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 border border-slate-700">
                                  {(u.profile?.displayName || u.email)[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-white">
                                  {u.profile?.displayName || 'Chưa đặt tên'}
                                </p>
                                <p className="text-[11px] text-slate-400">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {isAdmin ? (
                              <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 font-bold rounded border border-rose-500/30 text-[10px]">
                                ADMIN
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 font-medium rounded text-[10px]">
                                USER
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-slate-300">
                            <p>
                              {u.profile?.gender === 'male'
                                ? 'Nam'
                                : u.profile?.gender === 'female'
                                ? 'Nữ'
                                : u.profile?.gender || 'N/A'}{' '}
                              • {u.profile?.city || 'Toàn quốc'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Ảnh: {u.photos?.length || 0} | Lượt match: {u.stats?.matchesCount || 0}
                            </p>
                          </td>

                          <td className="py-3 px-3">
                            {u.ageVerified ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                                <CheckCircle className="w-3.5 h-3.5" /> Đã xác thực
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500 text-[11px]">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70" /> Chưa xác thực
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            {isSuspended ? (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 font-bold rounded border border-red-500/30 text-[10px]">
                                ĐÃ KHOÁ
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold rounded border border-emerald-500/30 text-[10px]">
                                HOẠT ĐỘNG
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-slate-400 text-[11px]">
                            {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View detail */}
                              <button
                                onClick={() => setSelectedUserDetail(u)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                                title="Xem chi tiết hồ sơ & ảnh"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle 18+ */}
                              <button
                                onClick={() => handleToggleVerifyAge(u)}
                                disabled={userActionLoading === u.id}
                                className={`p-1.5 rounded-lg transition ${
                                  u.ageVerified
                                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                }`}
                                title={u.ageVerified ? 'Thu hồi xác minh 18+' : 'Cấp xác minh 18+'}
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Role */}
                              <button
                                onClick={() => handleToggleRole(u)}
                                disabled={userActionLoading === u.id || u.id === currentAdmin?.id}
                                className={`p-1.5 rounded-lg transition ${
                                  isAdmin
                                    ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                                }`}
                                title={isAdmin ? 'Hạ xuống thành User' : 'Nâng cấp thành Admin'}
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Suspend */}
                              <button
                                onClick={() => handleToggleSuspendUser(u)}
                                disabled={userActionLoading === u.id || u.id === currentAdmin?.id}
                                className={`p-1.5 rounded-lg transition ${
                                  isSuspended
                                    ? 'bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50'
                                    : 'bg-rose-600/30 text-rose-300 hover:bg-rose-600/50'
                                }`}
                                title={isSuspended ? 'Mở khoá tài khoản' : 'Khoá tài khoản'}
                              >
                                {isSuspended ? (
                                  <Unlock className="w-3.5 h-3.5" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {userTotalPages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t border-slate-800 text-xs text-slate-400">
                    <span>
                      Trang {userPage} / {userTotalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                        disabled={userPage <= 1}
                        className="px-3 py-1 bg-slate-800 rounded-lg disabled:opacity-40"
                      >
                        Trước
                      </button>
                      <button
                        onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                        disabled={userPage >= userTotalPages}
                        className="px-3 py-1 bg-slate-800 rounded-lg disabled:opacity-40"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REPORTS & SAFETY */}
        {activeTab === 'reports' && (
          <div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Xử lý Báo cáo Vi phạm</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ưu tiên số 1: Báo cáo dưới 18 tuổi (minor) và khiêu dâm (nudity)
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 text-xs">
                {(['open', 'reviewed', 'actioned', 'all'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setReportFilter(st)}
                    className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition ${
                      reportFilter === st
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'open'
                      ? 'Chờ xử lý (Open)'
                      : st === 'actioned'
                      ? 'Đã xử phạt'
                      : st === 'reviewed'
                      ? 'Đã xem xét'
                      : 'Tất cả'}
                  </button>
                ))}
              </div>
            </div>

            {loadingReports ? (
              <div className="text-center py-16 text-slate-500 text-sm">Đang tải báo cáo...</div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <Shield className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-lg font-semibold text-slate-200">Không có báo cáo nào</h3>
                <p className="text-xs text-slate-400 mt-1">Hệ thống đang hoạt động an toàn và sạch sẽ.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((r) => {
                  const isUrgent = r.priority === 'urgent' || r.reason === 'minor';
                  return (
                    <div
                      key={r.id}
                      className={`p-5 rounded-2xl border transition ${
                        isUrgent
                          ? 'bg-rose-950/30 border-rose-500/70 shadow-lg shadow-rose-950/50'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          {isUrgent && (
                            <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-extrabold uppercase rounded animate-pulse">
                              KHẨN CẤP: DƯỚI 18 TUỔI
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-950/60 p-3.5 rounded-xl mb-3">
                        <div>
                          <p className="text-slate-400 mb-0.5">Người gửi báo cáo:</p>
                          <p className="font-semibold text-white">
                            {r.reporter.displayName}{' '}
                            <span className="text-slate-400 font-normal">({r.reporter.email})</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">Đối tượng bị tố cáo:</p>
                          <p className="font-semibold text-white">
                            {r.target.displayName}{' '}
                            <span className="text-slate-400 font-normal">({r.target.email})</span>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Trạng thái hiện tại: <span className="font-semibold">{r.target.status}</span>
                            {r.target.randomBannedUntil &&
                              ` (Khoá random video call đến ${new Date(
                                r.target.randomBannedUntil,
                              ).toLocaleDateString('vi-VN')})`}
                          </p>
                        </div>
                      </div>

                      {r.details && (
                        <div className="text-xs text-slate-300 mb-4 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                          <span className="text-slate-500 block mb-0.5">Nội dung chi tiết tố cáo:</span>
                          {r.details}
                        </div>
                      )}

                      {r.status === 'open' && (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                          <button
                            onClick={() => handleResolveReport(r.id, 'dismiss')}
                            disabled={reportActionLoading === r.id}
                            className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300 hover:text-white hover:border-slate-500"
                          >
                            Bỏ qua (Dismiss)
                          </button>
                          <button
                            onClick={() => handleResolveReport(r.id, 'warn')}
                            disabled={reportActionLoading === r.id}
                            className="px-3.5 py-1.5 rounded-xl border border-amber-500/40 text-xs text-amber-400 hover:bg-amber-500/10"
                          >
                            Cảnh cáo (Warn)
                          </button>
                          <button
                            onClick={() => handleResolveReport(r.id, 'suspend')}
                            disabled={reportActionLoading === r.id}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                          >
                            Khoá tài khoản (Suspend)
                          </button>
                          <button
                            onClick={() => handleResolveReport(r.id, 'ban')}
                            disabled={reportActionLoading === r.id}
                            className="px-3.5 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-xs font-semibold text-white"
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

        {/* TAB 4: PHOTO MODERATION */}
        {activeTab === 'photos' && (
          <div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Kiểm duyệt Hình ảnh Người dùng</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Duyệt hoặc từ chối ảnh đại diện và album của người dùng để bảo đảm môi trường an toàn 18+
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 text-xs">
                {(['pending', 'approved', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setPhotoFilter(st)}
                    className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition ${
                      photoFilter === st
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'pending'
                      ? 'Chờ duyệt (Pending)'
                      : st === 'approved'
                      ? 'Đã duyệt'
                      : 'Đã từ chối'}
                  </button>
                ))}
              </div>
            </div>

            {loadingPhotos ? (
              <div className="text-center py-16 text-slate-500 text-sm">Đang tải ảnh...</div>
            ) : photos.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h3 className="text-lg font-semibold text-slate-200">Không có ảnh nào trong mục này</h3>
                <p className="text-xs text-slate-400 mt-1">Toàn bộ ảnh đã được kiểm duyệt đầy đủ.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col"
                  >
                    <div
                      className="h-64 bg-slate-950 relative cursor-pointer group"
                      onClick={() => setSelectedPhotoPreview(p.url)}
                    >
                      <img
                        src={p.url}
                        alt="Photo candidate"
                        className="w-full h-full object-cover transition group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="px-3 py-1 bg-black/70 text-white text-xs rounded-lg backdrop-blur">
                          Bấm để phóng to
                        </span>
                      </div>
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded backdrop-blur">
                        Vị trí: #{p.position + 1}
                      </span>
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-white truncate">
                          {p.user.displayName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{p.user.email}</p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Tải lên: {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
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

        {/* TAB 5: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Nhật ký Hoạt động Quản trị (Audit Logs)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lịch sử lưu vết các thao tác của Quản trị viên phục vụ truy vết và minh bạch
                </p>
              </div>
              <button
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                <span>Làm mới nhật ký</span>
              </button>
            </div>

            {loadingLogs ? (
              <div className="py-20 text-center text-slate-500 text-sm">Đang tải nhật ký...</div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center bg-slate-900/50 border border-slate-800 rounded-2xl">
                <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-300 font-semibold">Chưa có bản ghi nhật ký nào</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Thời gian</th>
                      <th className="py-3 px-3">Quản trị viên (Admin)</th>
                      <th className="py-3 px-3">Hành động</th>
                      <th className="py-3 px-3">Người dùng tác động</th>
                      <th className="py-3 px-4">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {logs.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                          {new Date(l.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 font-semibold text-rose-300">{l.adminEmail}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              l.action === 'suspend' || l.action === 'ban'
                                ? 'bg-red-500/20 text-red-400'
                                : l.action === 'warn'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {l.action}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-200">{l.targetEmail || 'Hệ thống'}</td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{l.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* USER DETAIL MODAL */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-lg text-rose-400 border border-slate-700">
                  {(selectedUserDetail.profile?.displayName || selectedUserDetail.email)[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedUserDetail.profile?.displayName || 'Chưa đặt tên'}
                  </h3>
                  <p className="text-xs text-slate-400">{selectedUserDetail.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Profile info details */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-5">
              <div>
                <span className="text-slate-500 block mb-0.5">User ID:</span>
                <span className="font-mono text-slate-300 break-all">{selectedUserDetail.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Vai trò & Trạng thái:</span>
                <span className="font-semibold text-white uppercase">{selectedUserDetail.role}</span> •{' '}
                <span
                  className={
                    selectedUserDetail.status === 'suspended' ? 'text-red-400' : 'text-emerald-400'
                  }
                >
                  {selectedUserDetail.status}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Giới tính & Thành phố:</span>
                <span className="text-slate-300">
                  {selectedUserDetail.profile?.gender || 'N/A'} •{' '}
                  {selectedUserDetail.profile?.city || 'Toàn quốc'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Xác minh 18+:</span>
                <span
                  className={
                    selectedUserDetail.ageVerified ? 'text-emerald-400 font-bold' : 'text-slate-400'
                  }
                >
                  {selectedUserDetail.ageVerified ? 'ĐÃ XÁC MINH' : 'CHƯA XÁC MINH'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block mb-0.5">Giới thiệu (Bio):</span>
                <span className="text-slate-300">
                  {selectedUserDetail.profile?.bio || 'Người dùng chưa cập nhật phần giới thiệu.'}
                </span>
              </div>
            </div>

            {/* User photos gallery */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Bộ sưu tập ảnh ({selectedUserDetail.photos?.length || 0} ảnh)
              </h4>
              {!selectedUserDetail.photos || selectedUserDetail.photos.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Người dùng chưa tải lên ảnh nào.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {selectedUserDetail.photos.map((ph) => (
                    <div
                      key={ph.id}
                      className="relative rounded-xl overflow-hidden aspect-square border border-slate-800 bg-slate-950"
                    >
                      <img src={ph.url} alt="User upload" className="w-full h-full object-cover" />
                      <span
                        className={`absolute bottom-1 right-1 px-1.5 py-0.5 text-[9px] rounded font-bold uppercase ${
                          ph.moderationStatus === 'approved'
                            ? 'bg-emerald-600/80 text-white'
                            : ph.moderationStatus === 'rejected'
                            ? 'bg-red-600/80 text-white'
                            : 'bg-amber-600/80 text-white'
                        }`}
                      >
                        {ph.moderationStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal action buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                onClick={() => handleToggleVerifyAge(selectedUserDetail)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-xl transition"
              >
                {selectedUserDetail.ageVerified ? 'Thu hồi 18+' : 'Cấp xác minh 18+'}
              </button>
              <button
                onClick={() => handleToggleSuspendUser(selectedUserDetail)}
                disabled={selectedUserDetail.id === currentAdmin?.id}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition ${
                  selectedUserDetail.status === 'suspended'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {selectedUserDetail.status === 'suspended' ? 'Mở khoá tài khoản' : 'Khoá tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL PHOTO PREVIEW MODAL */}
      {selectedPhotoPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedPhotoPreview(null)}
        >
          <div className="max-w-3xl max-h-[90vh] relative">
            <img
              src={selectedPhotoPreview}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
            <p className="text-center text-xs text-slate-400 mt-2">Bấm bất kỳ đâu để đóng</p>
          </div>
        </div>
      )}
    </div>
  );
};

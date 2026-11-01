import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';

export const AdminRoute = () => {
  const { user, isAuthenticated, isInitialized, isLoading } = useAuthStore();

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="text-5xl mb-4">⛔</div>
        <h1 className="text-2xl font-bold text-white mb-2">403 - Quyền truy cập bị từ chối</h1>
        <p className="text-sm text-slate-400 mb-6 max-w-md">
          Khu vực này chỉ dành cho quản trị viên (Admin) của MeetCall.
        </p>
        <a
          href="/"
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition"
        >
          Trở về trang chủ
        </a>
      </div>
    );
  }

  return <Outlet />;
};

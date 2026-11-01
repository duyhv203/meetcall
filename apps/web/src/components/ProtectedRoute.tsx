import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { useProfileStore } from '../stores/profileStore.js';

export function ProtectedRoute() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const { me, isLoading: profileLoading, fetchMe } = useProfileStore();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated && !me && !profileLoading) {
      void fetchMe();
    }
  }, [isAuthenticated, me, profileLoading, fetchMe]);

  if (!isInitialized || (isAuthenticated && !me && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Đang khởi tạo phiên làm việc...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isOnboardingPath = location.pathname === '/onboarding';

  // If onboarding is not completed, force redirect to /onboarding
  if (me && !me.onboardingCompleted && !isOnboardingPath) {
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding is completed and user navigates to /onboarding, redirect to home
  if (me && me.onboardingCompleted && isOnboardingPath) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

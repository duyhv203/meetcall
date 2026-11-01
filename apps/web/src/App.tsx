import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './stores/authStore.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage.js';
import { HomePage } from './features/home/HomePage.js';
import { OnboardingPage } from './features/onboarding/OnboardingPage.js';
import { ProfileSettingsPage } from './features/settings/ProfileSettingsPage.js';
import { DiscoverPage } from './features/discover/DiscoverPage.js';
import { MatchesPage } from './features/matches/MatchesPage.js';
import { ChatPage } from './features/chat/ChatPage.js';
import { CallPage } from './features/calls/CallPage.js';
import { RandomPage } from './features/random/RandomPage.js';
import { BlockedUsersPage } from './features/settings/BlockedUsersPage.js';
import { SettingsPage } from './features/settings/SettingsPage.js';
import { TermsPage } from './features/legal/TermsPage.js';
import { PrivacyPage } from './features/legal/PrivacyPage.js';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage.js';
import { IncomingCallModal } from './components/IncomingCallModal.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { AdminRoute } from './components/AdminRoute.js';

export function App() {
  const { isInitialized, restoreSession } = useAuthStore();

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Đang khởi tạo MeetCall...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <IncomingCallModal />
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Public Legal Routes */}
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Protected App Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/profile" element={<ProfileSettingsPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/chat/:matchId" element={<ChatPage />} />
          <Route path="/call/:matchId" element={<CallPage />} />
          <Route path="/call" element={<CallPage />} />
          <Route path="/random" element={<RandomPage />} />
          <Route path="/settings/blocked" element={<BlockedUsersPage />} />
        </Route>

        {/* Protected Admin Routes */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

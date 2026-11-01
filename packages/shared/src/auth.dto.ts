import type { UserRole, UserStatus } from './types.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  ageVerified: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterRequest {
  email: string;
  password: string;
  birthdate: string; // ISO date format YYYY-MM-DD
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface AuthSuccessMessage {
  success: boolean;
  message?: string;
}

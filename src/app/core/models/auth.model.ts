import { Role } from './role.model';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  address?: string;
  userGroupId?: number;
}

/** Response body for both /api/auth/login and /api/auth/register (LoginResponse in the API docs). */
export interface AuthResponse {
  token: string;
  tokenType: string;
  userId: number;
  username: string;
  role: Role;
  expiresInSeconds: number;
}

/** Decoded JWT payload - drives routing/guards/UI only, never the security boundary itself. */
export interface CurrentUser {
  userId: number;
  username: string;
  role: Role;
  exp: number;
}

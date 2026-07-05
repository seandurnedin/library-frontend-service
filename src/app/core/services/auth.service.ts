import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, CurrentUser, LoginRequest, RegisterRequest } from '../models/auth.model';
import { Role } from '../models/role.model';

const TOKEN_KEY = 'library_app_jwt';

/**
 * Decodes a JWT payload client-side, purely to drive routing/guards/UI (which tab to show,
 * when to silently log out on expiry). This is NOT a security boundary - the token is still
 * verified server-side on every request. No external jwt-decode dependency needed for something
 * this small: a JWT payload is just base64url-encoded JSON.
 */
function decodeJwtPayload(token: string): CurrentUser | null {
  try {
    const payloadSegment = token.split('.')[1];
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    const payload = JSON.parse(json);
    return {
      userId: payload['userId'],
      username: payload['sub'],
      role: payload['role'],
      exp: payload['exp'],
    };
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** null = logged out. Restored from sessionStorage on service construction (app bootstrap). */
  readonly currentUser = signal<CurrentUser | null>(this.restoreFromStorage());

  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly role = computed<Role | null>(() => this.currentUser()?.role ?? null);

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/login`, request)
      .pipe(tap((response) => this.applySession(response)));
  }

  /** Deliberately does NOT establish a session - registering creates the account, but the user
   *  still has to log in themselves afterwards (see Login component). */
  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/register`, request);
  }

  logout(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  /** Where to land a logged-in user - roles don't share a landing tab (see sidebar/guards). */
  defaultRouteForRole(role: Role | null): string {
    switch (role) {
      case 'ADMIN':
        return '/admin/roles';
      case 'MANAGER':
      case 'USER':
        return '/books';
      default:
        return '/login';
    }
  }

  private applySession(response: AuthResponse): void {
    sessionStorage.setItem(TOKEN_KEY, response.token);
    this.currentUser.set(decodeJwtPayload(response.token));
  }

  private restoreFromStorage(): CurrentUser | null {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const decoded = decodeJwtPayload(token);
    if (!decoded || decoded.exp * 1000 < Date.now()) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return decoded;
  }
}

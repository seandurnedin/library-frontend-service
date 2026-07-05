import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserBorrowingHistory, UserProfile } from '../models/user.model';

/** Self-service profile/history - distinct from UserAdminService, which is ADMIN-only. */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/users`;

  me(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/me`);
  }

  myHistory(): Observable<UserBorrowingHistory[]> {
    return this.http.get<UserBorrowingHistory[]>(`${this.baseUrl}/me/history`);
  }
}

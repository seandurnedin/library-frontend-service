import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role } from '../models/role.model';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/admin`;

  /** ADMIN only. Lists every user with a given role - used to render the role-management table
   *  one role group at a time (see UserRolesComponent). */
  listByRole(role: Role): Observable<User[]> {
    const params = new HttpParams().set('role', role);
    return this.http.get<User[]>(`${this.baseUrl}/users`, { params });
  }

  updateRole(userId: number, role: Role): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/users/${userId}/role`, { role });
  }

  /** Moves a user to a different user group (borrowing limits/duration are group-level). */
  updateGroup(userId: number, userGroupId: number): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/users/${userId}/group`, { userGroupId });
  }
}

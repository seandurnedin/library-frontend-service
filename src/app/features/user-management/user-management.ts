import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { UserAdminService } from '../../core/services/user-admin.service';
import { Role } from '../../core/models/role.model';
import { User } from '../../core/models/user.model';

const ROLE_OPTIONS: Role[] = ['USER', 'MANAGER', 'ADMIN'];

interface PendingRoleChange {
  user: User;
  role: Role;
}

@Component({
  selector: 'app-user-management',
  imports: [FormsModule, ButtonModule, SelectModule, DialogModule, TagModule],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagement {
  private readonly userAdminService = inject(UserAdminService);
  private readonly messageService = inject(MessageService);

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly selectedRole = signal<Role>('USER');
  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(false);
  protected readonly savingUserId = signal<number | null>(null);

  /** Draft role picks per user row - picking a new role only stages it here; nothing is sent to
   *  the backend until the confirm dialog is accepted. */
  private readonly roleDrafts = signal<Record<number, Role>>({});
  protected readonly pendingRoleChange = signal<PendingRoleChange | null>(null);

  constructor() {
    this.loadUsers();
  }

  onRoleFilterChange(role: Role): void {
    this.selectedRole.set(role);
    this.loadUsers();
  }

  draftRole(user: User): Role {
    return this.roleDrafts()[user.id] ?? user.role;
  }

  hasPendingRoleChange(user: User): boolean {
    return this.draftRole(user) !== user.role;
  }

  setDraftRole(user: User, role: Role): void {
    this.roleDrafts.update((map) => ({ ...map, [user.id]: role }));
  }

  confirmRoleChange(user: User): void {
    const role = this.draftRole(user);
    if (role === user.role) return;
    this.pendingRoleChange.set({ user, role });
  }

  cancelRoleChange(): void {
    this.pendingRoleChange.set(null);
  }

  applyRoleChange(): void {
    const pending = this.pendingRoleChange();
    if (!pending) return;

    const { user, role } = pending;
    this.savingUserId.set(user.id);
    this.userAdminService.updateRole(user.id, role).subscribe({
      next: () => {
        this.savingUserId.set(null);
        this.pendingRoleChange.set(null);
        this.messageService.add({ severity: 'success', summary: `${user.username}'s role updated to ${role}` });
        this.loadUsers();
      },
      error: (err: unknown) => {
        this.savingUserId.set(null);
        this.pendingRoleChange.set(null);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not update role',
          detail: this.errorMessage(err),
        });
      },
    });
  }

  private loadUsers(): void {
    this.loading.set(true);
    this.userAdminService.listByRole(this.selectedRole()).subscribe({
      next: (users) => {
        this.users.set(users);
        this.roleDrafts.set({});
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load users' });
      },
    });
  }

  private errorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return (err.error as { message?: string } | null)?.message ?? 'Please try again.';
    }
    return 'Please try again.';
  }
}

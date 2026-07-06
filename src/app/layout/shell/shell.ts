import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PopoverModule } from 'primeng/popover';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role } from '../../core/models/role.model';
import { MeMenu } from '../me-menu/me-menu';

interface NavItem {
  label: string;
  path: string;
  roles: Role[];
}

/** Left-hand tabs, filtered per signed-in user's role - kept in one place so adding a tab is a
 *  one-line change here plus the matching child route in app.routes.ts. */
const NAV_ITEMS: NavItem[] = [
  { label: 'Catalogue', path: '/books', roles: ['USER', 'MANAGER'] },
  { label: 'Lending', path: '/lending', roles: ['MANAGER'] },
  { label: 'User Management', path: '/admin/roles', roles: ['ADMIN'] },
];

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, DatePipe, PopoverModule, OverlayBadgeModule, ToastModule, ConfirmDialogModule, MeMenu],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit, OnDestroy {
  protected readonly authService = inject(AuthService);
  protected readonly notificationService = inject(NotificationService);

  protected readonly navItems = computed(() => {
    const role = this.authService.role();
    return NAV_ITEMS.filter((item) => role !== null && item.roles.includes(role));
  });

  ngOnInit(): void {
    // Live stream for anything that fires from now on, plus a one-off catch-up for whatever
    // fired while this user wasn't connected (server restart, browser closed, etc.).
    this.notificationService.connect();
    this.notificationService.fetchMine().subscribe();
  }

  ngOnDestroy(): void {
    // Shell is destroyed whenever the user leaves the authenticated area (logout, 401, etc.) -
    // reset() (not just disconnect()) so the next login on this tab doesn't inherit this user's
    // leftover notifications.
    this.notificationService.reset();
  }
}

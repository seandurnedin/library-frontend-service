import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.model';

/**
 * Factory, not a plain guard - so each route can declare which roles are allowed:
 *   canActivate: [roleGuard(['ADMIN'])]
 * Assumes authGuard already ran (see app.routes.ts - it's always paired with this one), so a
 * missing session here just means "role doesn't match", not "not logged in at all".
 */
export function roleGuard(allowedRoles: Role[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const role = authService.role();
    if (role && allowedRoles.includes(role)) {
      return true;
    }
    // Logged in, just not allowed here - send them to whatever tab *is* theirs, not to login.
    return router.createUrlTree([authService.defaultRouteForRole(role)]);
  };
}

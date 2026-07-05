import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Attaches the JWT to every request aimed at our own backend (library-service). Requests to
 * other origins - none exist in this app today, but the check is cheap insurance against ever
 * leaking the token to a third party by accident - are left untouched.
 * On a 401 (expired/invalid token, or backend rejected it), logs out and bounces to /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const isOwnApi = req.url.startsWith(environment.apiBaseUrl);
  const token = authService.getToken();

  const authedReq = isOwnApi && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && isOwnApi) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};

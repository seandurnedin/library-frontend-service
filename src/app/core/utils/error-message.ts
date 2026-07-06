import { HttpErrorResponse } from '@angular/common/http';

/** Pulls the backend's `message` field out of an error response (see GlobalExceptionHandler in
 *  library-service), falling back to a generic prompt when there isn't one. Shared by every
 *  component that surfaces API errors in a toast. */
export function extractErrorMessage(err: unknown, fallback = 'Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    return (err.error as { message?: string } | null)?.message ?? fallback;
  }
  return fallback;
}

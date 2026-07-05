import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Reservation, ReserveRequest } from '../models/reservation.model';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/reservations`;

  /** Reserves a book - holds a copy immediately if one's available, otherwise joins the FIFO
   *  waitlist. The response's `status` (NOTIFIED vs RESERVED) tells you which happened. */
  reserve(request: ReserveRequest): Observable<Reservation> {
    return this.http.post<Reservation>(this.baseUrl, request);
  }

  cancel(reservationId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${reservationId}`);
  }

  myWishlist(): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.baseUrl}/my-wishlist`);
  }

  /** MANAGER only - every active (RESERVED or NOTIFIED) reservation for a book. */
  forBook(bookId: number): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.baseUrl}/book/${bookId}`);
  }

  /** MANAGER only - cancels any member's reservation for a book on their behalf. */
  cancelForBook(bookId: number, reservationId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/book/${bookId}/${reservationId}`);
  }
}

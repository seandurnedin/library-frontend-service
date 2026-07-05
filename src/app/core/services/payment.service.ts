import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthorisePaymentRequest, Payment, PaymentRequest } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/payments`;

  /** Mock payment - no real gateway is called server-side either. */
  pay(request: PaymentRequest): Observable<Payment> {
    return this.http.post<Payment>(`${this.baseUrl}/pay`, request);
  }

  /** MANAGER only - clears every PENDING payment for this user at once, by username. */
  authorise(request: AuthorisePaymentRequest): Observable<Payment[]> {
    return this.http.post<Payment[]>(`${this.baseUrl}/authorise`, request);
  }

  history(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.baseUrl}/history`);
  }
}

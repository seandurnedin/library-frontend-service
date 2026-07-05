import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BorrowingRecord, LoanRequest, ReturnRequest } from '../models/borrowing-record.model';

@Injectable({ providedIn: 'root' })
export class LendingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/lending`;

  /** MANAGER only (enforced server-side too - this is UX, not the security boundary). */
  loanBook(request: LoanRequest): Observable<BorrowingRecord> {
    return this.http.post<BorrowingRecord>(`${this.baseUrl}/loan`, request);
  }

  /** MANAGER only. */
  returnBook(request: ReturnRequest): Observable<BorrowingRecord> {
    return this.http.post<BorrowingRecord>(`${this.baseUrl}/return`, request);
  }

  myLoans(): Observable<BorrowingRecord[]> {
    return this.http.get<BorrowingRecord[]>(`${this.baseUrl}/my-loans`);
  }

  /** MANAGER only - every active (ON_LOAN or OVERDUE) loan for a book. */
  forBook(bookId: number): Observable<BorrowingRecord[]> {
    return this.http.get<BorrowingRecord[]>(`${this.baseUrl}/book/${bookId}`);
  }
}

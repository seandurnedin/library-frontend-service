import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AddBookRequest, Book, UpdateBookRequest } from '../models/book.model';
import { PageResponse } from '../models/page-response.model';

@Injectable({ providedIn: 'root' })
export class BookService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/books`;

  /** One method for both "browse" and "search" - mirrors library-service's BookController,
   *  which treats an empty/absent `search` the same way: full catalogue, still paged. */
  getBooks(page: number, size: number, search?: string): Observable<PageResponse<Book>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search && search.trim().length > 0) {
      params = params.set('search', search.trim());
    }
    return this.http.get<PageResponse<Book>>(this.baseUrl, { params });
  }

  getBook(id: number): Observable<Book> {
    return this.http.get<Book>(`${this.baseUrl}/${id}`);
  }

  addBook(request: AddBookRequest): Observable<Book> {
    return this.http.post<Book>(this.baseUrl, request);
  }

  /** MANAGER only. */
  updateBook(id: number, request: UpdateBookRequest): Observable<Book> {
    return this.http.put<Book>(`${this.baseUrl}/${id}`, request);
  }

  removeBook(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { BookService } from '../../core/services/book.service';
import { ReservationService } from '../../core/services/reservation.service';
import { LendingService } from '../../core/services/lending.service';
import { AuthService } from '../../core/services/auth.service';
import { Book, BookStatus } from '../../core/models/book.model';
import { Reservation } from '../../core/models/reservation.model';
import { BorrowingRecord } from '../../core/models/borrowing-record.model';
import { EnumLabelPipe } from '../../core/pipes/enum-label.pipe';

const PAGE_SIZE = 12;

/** A book can be reserved regardless of availability - except LOST, where there's nothing to
 *  ever hold or wait for. If copies are available, reserving holds one immediately (decrementing
 *  availableCopies server-side); if not, it joins the FIFO waitlist instead. Either way the
 *  response's `status` (NOTIFIED vs RESERVED) tells us which one happened. */
const RESERVABLE_STATUSES: BookStatus[] = ['IN_STORE', 'ON_LOAN', 'RESERVED'];

@Component({
  selector: 'app-catalogue',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DialogModule,
    PaginatorModule,
    TagModule,
    EnumLabelPipe,
  ],
  templateUrl: './catalogue.html',
  styleUrl: './catalogue.scss',
})
export class Catalogue implements OnInit {
  private readonly bookService = inject(BookService);
  private readonly reservationService = inject(ReservationService);
  private readonly lendingService = inject(LendingService);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  protected readonly isManager = computed(() => this.authService.role() === 'MANAGER');

  protected readonly books = signal<Book[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly first = signal(0);
  protected readonly loading = signal(false);
  protected readonly search = signal('');

  protected readonly selectedBook = signal<Book | null>(null);
  protected readonly reserving = signal(false);
  protected readonly removing = signal(false);

  protected readonly removeCopiesVisible = signal(false);
  protected readonly bookToRemove = signal<Book | null>(null);
  protected readonly removeCount = signal(1);

  protected readonly bookReservations = signal<Reservation[]>([]);
  protected readonly loadingReservations = signal(false);
  protected readonly cancellingReservationId = signal<number | null>(null);

  protected readonly bookLoans = signal<BorrowingRecord[]>([]);
  protected readonly loadingLoans = signal(false);

  protected readonly addBookVisible = signal(false);
  protected readonly savingBook = signal(false);
  protected readonly addBookForm = this.fb.nonNullable.group({
    isbn: ['', Validators.required],
    title: ['', Validators.required],
    author: ['', Validators.required],
    publisher: [''],
    publishedYear: this.fb.control<number | null>(null),
    genre: [''],
    totalCopies: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
  });

  ngOnInit(): void {
    this.loadBooks();
  }

  onPageChange(event: PaginatorState): void {
    this.first.set(event.first ?? 0);
    this.loadBooks();
  }

  onSearch(term: string): void {
    this.search.set(term);
    this.first.set(0);
    this.loadBooks();
  }

  openBook(book: Book): void {
    this.selectedBook.set(book);
    if (this.isManager()) {
      this.loadReservations(book.id);
      this.loadLoans(book.id);
    }
  }

  closeBook(): void {
    this.selectedBook.set(null);
    this.bookReservations.set([]);
    this.bookLoans.set([]);
  }

  /** MANAGER only - lets a manager remove any member's reservation, e.g. if they call to cancel
   *  or never come to collect a held copy. */
  cancelReservation(book: Book, reservation: Reservation): void {
    if (!confirm(`Remove ${reservation.username}'s reservation for "${book.title}"?`)) return;

    this.cancellingReservationId.set(reservation.id);
    this.reservationService.cancelForBook(book.id, reservation.id).subscribe({
      next: () => {
        this.cancellingReservationId.set(null);
        this.bookReservations.update((list) => list.filter((r) => r.id !== reservation.id));
        this.messageService.add({ severity: 'success', summary: 'Reservation removed' });
        // Cancelling a held (NOTIFIED) reservation releases a copy back to availability.
        this.loadBooks();
      },
      error: (err: unknown) => {
        this.cancellingReservationId.set(null);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not remove reservation',
          detail: this.errorMessage(err),
        });
      },
    });
  }

  canReserve(book: Book): boolean {
    return RESERVABLE_STATUSES.includes(book.status);
  }

  /** Label reflects what will actually happen: a copy free right now gets held immediately,
   *  otherwise this joins the waitlist - see RESERVABLE_STATUSES / reserveBook(). */
  reserveButtonLabel(book: Book): string {
    return book.availableCopies > 0 ? 'Reserve Copy' : 'Join Waitlist';
  }

  reserveBook(book: Book): void {
    this.reserving.set(true);
    this.reservationService.reserve({ bookId: book.id }).subscribe({
      next: (reservation) => {
        this.reserving.set(false);
        const message =
          reservation.status === 'NOTIFIED'
            ? { summary: 'Copy held for you', detail: `"${book.title}" is ready for pickup.` }
            : {
                summary: 'Added to waitlist',
                detail: `"${book.title}" - you're #${reservation.queuePosition} in line.`,
              };
        this.messageService.add({ severity: 'success', ...message });
        this.closeBook();
        // Reserving may have decremented availableCopies (or flipped status) server-side.
        this.loadBooks();
      },
      error: (err: unknown) => {
        this.reserving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not reserve the book',
          detail: this.errorMessage(err),
        });
      },
    });
  }

  openAddBook(): void {
    this.addBookForm.reset({ totalCopies: 1 });
    this.addBookVisible.set(true);
  }

  submitAddBook(): void {
    if (this.addBookForm.invalid) {
      this.addBookForm.markAllAsTouched();
      return;
    }

    this.savingBook.set(true);
    const raw = this.addBookForm.getRawValue();
    this.bookService
      .addBook({
        ...raw,
        publisher: raw.publisher || undefined,
        genre: raw.genre || undefined,
        publishedYear: raw.publishedYear ?? undefined,
      })
      .subscribe({
        next: () => {
          this.savingBook.set(false);
          this.addBookVisible.set(false);
          this.messageService.add({ severity: 'success', summary: 'Book added' });
          this.loadBooks();
        },
        error: (err: unknown) => {
          this.savingBook.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Could not add book',
            detail: this.errorMessage(err),
          });
        },
      });
  }

  openRemoveCopies(book: Book): void {
    this.bookToRemove.set(book);
    this.removeCount.set(1);
    this.removeCopiesVisible.set(true);
  }

  closeRemoveCopies(): void {
    this.removeCopiesVisible.set(false);
    this.bookToRemove.set(null);
  }

  /** p-inputNumber has no built-in min/max clamping in this version, so clamp by hand. */
  setRemoveCount(value: number | null, maxCopies: number): void {
    const clamped = value === null ? 1 : Math.min(Math.max(Math.round(value), 1), maxCopies);
    this.removeCount.set(clamped);
  }

  /** Removing all copies deletes the catalogue entry entirely (that's the only thing the DELETE
   *  endpoint can do); removing fewer just lowers totalCopies via the update endpoint. */
  confirmRemoveCopies(): void {
    const book = this.bookToRemove();
    const count = this.removeCount();
    if (!book || count < 1 || count > book.totalCopies) return;

    const removingAll = count >= book.totalCopies;
    this.removing.set(true);

    const request$: Observable<unknown> = removingAll
      ? this.bookService.removeBook(book.id)
      : this.bookService.updateBook(book.id, { totalCopies: book.totalCopies - count });

    request$.subscribe({
      next: () => {
        this.removing.set(false);
        this.messageService.add({
          severity: 'success',
          summary: removingAll ? 'Book removed' : `Removed ${count} cop${count === 1 ? 'y' : 'ies'}`,
        });
        this.closeRemoveCopies();
        this.closeBook();
        this.loadBooks();
      },
      error: (err: unknown) => {
        this.removing.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not remove copies',
          detail: this.errorMessage(err),
        });
      },
    });
  }

  statusSeverity(status: BookStatus): 'success' | 'warn' | 'info' | 'danger' {
    switch (status) {
      case 'IN_STORE':
        return 'success';
      case 'ON_LOAN':
        return 'warn';
      case 'RESERVED':
        return 'info';
      case 'LOST':
        return 'danger';
    }
  }

  private loadBooks(): void {
    this.loading.set(true);
    const page = Math.floor(this.first() / PAGE_SIZE);
    this.bookService.getBooks(page, PAGE_SIZE, this.search()).subscribe({
      next: (response) => {
        this.books.set(response.content);
        this.totalRecords.set(response.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load the catalogue' });
      },
    });
  }

  private loadReservations(bookId: number): void {
    this.loadingReservations.set(true);
    this.reservationService.forBook(bookId).subscribe({
      next: (reservations) => {
        this.bookReservations.set(reservations);
        this.loadingReservations.set(false);
      },
      error: () => {
        this.loadingReservations.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load reservations' });
      },
    });
  }

  private loadLoans(bookId: number): void {
    this.loadingLoans.set(true);
    this.lendingService.forBook(bookId).subscribe({
      next: (loans) => {
        this.bookLoans.set(loans);
        this.loadingLoans.set(false);
      },
      error: () => {
        this.loadingLoans.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load loans' });
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

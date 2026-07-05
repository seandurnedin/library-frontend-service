import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { ReservationService } from '../../core/services/reservation.service';
import { UserService } from '../../core/services/user.service';
import { PaymentService } from '../../core/services/payment.service';
import { Reservation } from '../../core/models/reservation.model';
import { UserBorrowingHistory, UserProfile } from '../../core/models/user.model';
import { Payment, PaymentType } from '../../core/models/payment.model';

/** Cancellable states - a FULFILLED/EXPIRED reservation is history, not something to withdraw. */
const CANCELLABLE_STATUSES: Reservation['status'][] = ['RESERVED', 'NOTIFIED'];
const PAYMENT_TYPES: PaymentType[] = ['LATE_FEE', 'RESERVATION_FEE', 'LOST_BOOK_CHARGE', 'OTHER'];

@Component({
  selector: 'app-me-menu',
  imports: [FormsModule, DialogModule, ButtonModule, TagModule, SelectModule, InputNumberModule],
  templateUrl: './me-menu.html',
  styleUrl: './me-menu.scss',
})
export class MeMenu {
  private readonly authService = inject(AuthService);
  private readonly reservationService = inject(ReservationService);
  private readonly userService = inject(UserService);
  private readonly paymentService = inject(PaymentService);
  private readonly messageService = inject(MessageService);

  protected readonly visible = signal(false);
  protected readonly username = computed(() => this.authService.currentUser()?.username ?? '');

  protected readonly loadingProfile = signal(false);
  protected readonly profile = signal<UserProfile | null>(null);

  protected readonly loadingWishlist = signal(false);
  protected readonly wishlist = signal<Reservation[]>([]);
  protected readonly cancellingId = signal<number | null>(null);

  protected readonly loadingHistory = signal(false);
  protected readonly history = signal<UserBorrowingHistory[]>([]);

  protected readonly loadingPayments = signal(false);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly paymentTypes = PAYMENT_TYPES;
  protected readonly paymentAmount = signal<number | null>(null);
  protected readonly paymentType = signal<PaymentType>('OTHER');
  protected readonly paying = signal(false);

  open(): void {
    this.visible.set(true);
    this.loadProfile();
    this.loadWishlist();
    this.loadHistory();
    this.loadPayments();
  }

  close(): void {
    this.visible.set(false);
  }

  isCancellable(reservation: Reservation): boolean {
    return CANCELLABLE_STATUSES.includes(reservation.status);
  }

  cancelReservation(reservation: Reservation): void {
    if (!confirm(`Remove "${reservation.bookTitle}" from your wishlist?`)) return;

    this.cancellingId.set(reservation.id);
    this.reservationService.cancel(reservation.id).subscribe({
      next: () => {
        this.cancellingId.set(null);
        this.wishlist.update((list) => list.filter((r) => r.id !== reservation.id));
        this.messageService.add({ severity: 'success', summary: 'Reservation cancelled' });
      },
      error: (err: unknown) => {
        this.cancellingId.set(null);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not cancel reservation',
          detail: this.errorMessage(err),
        });
      },
    });
  }

  /** Mock payment - library-service doesn't call a real gateway either, so all this does is file
   *  the request and refresh payment history; there's nothing else to reconcile. */
  makePayment(): void {
    const user = this.authService.currentUser();
    const amount = this.paymentAmount();
    if (!user || amount === null || amount <= 0) return;

    this.paying.set(true);
    this.paymentService.pay({ userId: user.userId, amount, type: this.paymentType() }).subscribe({
      next: () => {
        this.paying.set(false);
        this.paymentAmount.set(null);
        this.messageService.add({ severity: 'success', summary: 'Payment submitted' });
        this.loadPayments();
      },
      error: (err: unknown) => {
        this.paying.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not submit payment',
          detail: this.errorMessage(err),
        });
      },
    });
  }

  logout(): void {
    this.authService.logout();
  }

  private loadProfile(): void {
    this.loadingProfile.set(true);
    this.userService.me().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loadingProfile.set(false);
        if (profile.outstandingBalance > 0 && this.paymentAmount() === null) {
          this.paymentAmount.set(profile.outstandingBalance);
        }
      },
      error: () => {
        this.loadingProfile.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load your profile' });
      },
    });
  }

  private loadWishlist(): void {
    this.loadingWishlist.set(true);
    this.reservationService.myWishlist().subscribe({
      next: (reservations) => {
        this.wishlist.set(reservations);
        this.loadingWishlist.set(false);
      },
      error: () => {
        this.loadingWishlist.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load your wishlist' });
      },
    });
  }

  private loadHistory(): void {
    this.loadingHistory.set(true);
    this.userService.myHistory().subscribe({
      next: (history) => {
        this.history.set(history);
        this.loadingHistory.set(false);
      },
      error: () => {
        this.loadingHistory.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load your borrowing history' });
      },
    });
  }

  private loadPayments(): void {
    this.loadingPayments.set(true);
    this.paymentService.history().subscribe({
      next: (payments) => {
        this.payments.set(payments);
        this.loadingPayments.set(false);
      },
      error: () => {
        this.loadingPayments.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load your payment history' });
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

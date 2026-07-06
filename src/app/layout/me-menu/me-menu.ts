import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { Popover, PopoverModule } from 'primeng/popover';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { ReservationService } from '../../core/services/reservation.service';
import { UserService } from '../../core/services/user.service';
import { PaymentService } from '../../core/services/payment.service';
import { Reservation } from '../../core/models/reservation.model';
import { UserBorrowingHistory, UserProfile } from '../../core/models/user.model';
import { Payment, PaymentType } from '../../core/models/payment.model';
import { EnumLabelPipe } from '../../core/pipes/enum-label.pipe';
import { extractErrorMessage } from '../../core/utils/error-message';

/** Cancellable states - a FULFILLED/EXPIRED reservation is history, not something to withdraw. */
const CANCELLABLE_STATUSES: Reservation['status'][] = ['RESERVED', 'NOTIFIED'];
const PAYMENT_TYPES: PaymentType[] = ['LATE_FEE', 'RESERVATION_FEE', 'LOST_BOOK_CHARGE', 'OTHER'];
/** p-select shows `label` but binds `value` - so the dropdown reads "LATE FEE" while still
 *  submitting the real "LATE_FEE" enum constant. */
const PAYMENT_TYPE_OPTIONS = PAYMENT_TYPES.map((value) => ({ label: value.replace(/_/g, ' '), value }));

/**
 * The person icon in the top bar. Clicking it opens a small dropdown with two actions:
 * "User Profile" (opens the profile dialog: profile, wishlist, history, payments) and "Log out".
 */
@Component({
  selector: 'app-me-menu',
  imports: [FormsModule, DialogModule, ButtonModule, TagModule, SelectModule, InputNumberModule, PopoverModule, EnumLabelPipe],
  templateUrl: './me-menu.html',
  styleUrl: './me-menu.scss',
})
export class MeMenu {
  private readonly authService = inject(AuthService);
  private readonly reservationService = inject(ReservationService);
  private readonly userService = inject(UserService);
  private readonly paymentService = inject(PaymentService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  private readonly menu = viewChild.required<Popover>('menu');

  protected readonly profileVisible = signal(false);
  protected readonly historyVisible = signal(false);
  protected readonly paymentsVisible = signal(false);
  protected readonly username = computed(() => this.authService.currentUser()?.username ?? '');
  protected readonly role = computed(() => this.authService.role() ?? '');
  /** JWT role is the reliable source (the profile endpoint returns role lowercase). A plain USER
   *  has no meaningful role/group to show, so those rows are hidden for them. */
  protected readonly showRoleAndGroup = computed(() => this.role() !== 'USER' && this.role() !== '');

  protected readonly loadingProfile = signal(false);
  protected readonly profile = signal<UserProfile | null>(null);
  /** Payments can only be made against fees the user actually owes (mirrors the backend check). */
  protected readonly hasOutstanding = computed(() => (this.profile()?.outstandingBalance ?? 0) > 0);

  protected readonly loadingWishlist = signal(false);
  protected readonly wishlist = signal<Reservation[]>([]);
  protected readonly cancellingId = signal<number | null>(null);

  protected readonly loadingHistory = signal(false);
  protected readonly history = signal<UserBorrowingHistory[]>([]);

  protected readonly loadingPayments = signal(false);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly paymentTypes = PAYMENT_TYPE_OPTIONS;
  protected readonly paymentAmount = signal<number | null>(null);
  protected readonly paymentType = signal<PaymentType>('OTHER');
  protected readonly paying = signal(false);

  toggleMenu(event: Event): void {
    this.menu().toggle(event);
  }

  openProfile(): void {
    this.menu().hide();
    this.profileVisible.set(true);
    this.loadProfile();
    this.loadWishlist();
  }

  closeProfile(): void {
    this.profileVisible.set(false);
  }

  openHistory(): void {
    this.historyVisible.set(true);
    this.loadHistory();
  }

  openPayments(): void {
    this.paymentsVisible.set(true);
    this.loadPayments();
  }

  logout(): void {
    this.menu().hide();
    this.authService.logout();
  }

  isCancellable(reservation: Reservation): boolean {
    return CANCELLABLE_STATUSES.includes(reservation.status);
  }

  cancelReservation(reservation: Reservation): void {
    this.confirmationService.confirm({
      header: 'Remove from Wishlist',
      message: `Remove "${reservation.bookTitle}" from your wishlist?`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Remove', severity: 'danger' },
      rejectButtonProps: { label: 'Keep', severity: 'secondary', text: true },
      accept: () => this.doCancelReservation(reservation),
    });
  }

  /** Mock payment - library-service doesn't call a real gateway either, so all this does is file
   *  the request and refresh payment history; there's nothing else to reconcile. */
  makePayment(): void {
    const user = this.authService.currentUser();
    const amount = this.paymentAmount();
    const outstanding = this.profile()?.outstandingBalance ?? 0;
    if (!user || amount === null || amount <= 0 || outstanding <= 0) return;

    if (amount > outstanding) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Amount too high',
        detail: `Payment cannot exceed your outstanding balance of $${outstanding.toFixed(2)}.`,
      });
      return;
    }

    this.paying.set(true);
    this.paymentService.pay({ userId: user.userId, amount, type: this.paymentType() }).subscribe({
      next: () => {
        this.paying.set(false);
        this.paymentAmount.set(null);
        this.messageService.add({ severity: 'success', summary: 'Payment submitted' });
        // Balance shrinks after paying - refresh it (and the history, if that dialog is open).
        this.loadProfile();
        this.loadPayments();
      },
      error: (err: unknown) => {
        this.paying.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not submit payment',
          detail: extractErrorMessage(err),
        });
      },
    });
  }

  private doCancelReservation(reservation: Reservation): void {
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
          detail: extractErrorMessage(err),
        });
      },
    });
  }

  private loadProfile(): void {
    this.loadingProfile.set(true);
    this.userService.me().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loadingProfile.set(false);
        const balance = profile.outstandingBalance ?? 0;
        if (balance > 0 && this.paymentAmount() === null) {
          this.paymentAmount.set(balance);
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
}

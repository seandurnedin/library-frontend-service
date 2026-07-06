import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { LendingService } from '../../core/services/lending.service';
import { PaymentService } from '../../core/services/payment.service';
import { BorrowingRecord } from '../../core/models/borrowing-record.model';
import { extractErrorMessage } from '../../core/utils/error-message';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
/** Auto-dismiss delay for the success toasts on this page. */
const TOAST_LIFE_MS = 3000;

@Component({
  selector: 'app-lending',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, InputNumberModule],
  templateUrl: './lending.html',
  styleUrl: './lending.scss',
})
export class Lending {
  private readonly fb = inject(FormBuilder);
  private readonly lendingService = inject(LendingService);
  private readonly paymentService = inject(PaymentService);
  private readonly messageService = inject(MessageService);

  protected readonly loanForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    isbn: ['', Validators.required],
  });
  protected readonly loaning = signal(false);

  protected readonly returnForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    isbn: ['', Validators.required],
  });
  protected readonly returning = signal(false);

  protected readonly paymentForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });
  protected readonly authorising = signal(false);

  submitLoan(): void {
    if (this.loanForm.invalid) {
      this.loanForm.markAllAsTouched();
      return;
    }

    this.loaning.set(true);
    this.lendingService.loanBook(this.loanForm.getRawValue()).subscribe({
      next: (record) => {
        this.loaning.set(false);
        this.loanForm.reset();
        this.messageService.add({
          severity: 'success',
          summary: 'Book loaned out',
          detail: `${record.bookTitle} - due ${record.dueDate} (${this.dueDateNote(record)})`,
          life: TOAST_LIFE_MS,
        });
      },
      error: (err: unknown) => {
        this.loaning.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not loan the book',
          detail: extractErrorMessage(err),
        });
      },
    });
  }

  submitReturn(): void {
    if (this.returnForm.invalid) {
      this.returnForm.markAllAsTouched();
      return;
    }

    this.returning.set(true);
    this.lendingService.returnBook(this.returnForm.getRawValue()).subscribe({
      next: (record) => {
        this.returning.set(false);
        this.returnForm.reset();
        const feeNote =
          record.lateFee > 0 ? ` - late fee $${record.lateFee.toFixed(2)}` : ' - returned on time';
        this.messageService.add({
          severity: 'success',
          summary: 'Book returned',
          detail: record.bookTitle + feeNote,
          life: TOAST_LIFE_MS,
        });
      },
      error: (err: unknown) => {
        this.returning.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not return the book',
          detail: extractErrorMessage(err),
        });
      },
    });
  }

  /** Clears every PENDING payment for the given username at once - not one payment by id. */
  submitAuthorise(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const { username, amount } = this.paymentForm.getRawValue();
    this.authorising.set(true);
    this.paymentService.authorise({ username, amount: amount! }).subscribe({
      next: (payments) => {
        this.authorising.set(false);
        this.paymentForm.reset();
        const total = payments.reduce((sum, p) => sum + p.amount, 0);
        this.messageService.add({
          severity: 'success',
          summary: payments.length > 0 ? `${payments.length} payment(s) authorised` : 'No pending payments found',
          detail: payments.length > 0 ? `Total cleared: $${total.toFixed(2)}` : undefined,
          life: TOAST_LIFE_MS,
        });
      },
      error: (err: unknown) => {
        this.authorising.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not authorise payment',
          detail: extractErrorMessage(err),
        });
      },
    });
  }

  /** Human-readable "tracking the days" line for a loan - handles overdue and due-today too,
   *  instead of rendering nonsense like "-3 days remaining". */
  dueDateNote(record: BorrowingRecord): string {
    const days = Math.ceil((new Date(record.dueDate).getTime() - Date.now()) / MS_PER_DAY);
    if (days > 1) return `${days} days remaining`;
    if (days === 1) return '1 day remaining';
    if (days === 0) return 'due today';
    return days === -1 ? '1 day overdue' : `${-days} days overdue`;
  }
}

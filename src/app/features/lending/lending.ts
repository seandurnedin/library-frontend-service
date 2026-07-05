import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { LendingService } from '../../core/services/lending.service';
import { PaymentService } from '../../core/services/payment.service';
import { BorrowingRecord } from '../../core/models/borrowing-record.model';
import { Payment } from '../../core/models/payment.model';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

@Component({
  selector: 'app-lending',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, InputNumberModule, TagModule],
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
  protected readonly lastLoan = signal<BorrowingRecord | null>(null);

  protected readonly returnForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    isbn: ['', Validators.required],
  });
  protected readonly returning = signal(false);
  protected readonly lastReturn = signal<BorrowingRecord | null>(null);

  protected readonly paymentForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });
  protected readonly authorising = signal(false);
  protected readonly lastPayments = signal<Payment[]>([]);

  submitLoan(): void {
    if (this.loanForm.invalid) {
      this.loanForm.markAllAsTouched();
      return;
    }

    this.loaning.set(true);
    this.lendingService.loanBook(this.loanForm.getRawValue()).subscribe({
      next: (record) => {
        this.loaning.set(false);
        this.lastLoan.set(record);
        this.loanForm.reset();
        this.messageService.add({ severity: 'success', summary: 'Book loaned out', detail: record.bookTitle });
      },
      error: (err: unknown) => {
        this.loaning.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not loan the book',
          detail: this.errorMessage(err),
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
        this.lastReturn.set(record);
        this.returnForm.reset();
        const feeNote = record.lateFee > 0 ? ` - late fee $${record.lateFee.toFixed(2)}` : '';
        this.messageService.add({ severity: 'success', summary: 'Book returned' + feeNote, detail: record.bookTitle });
      },
      error: (err: unknown) => {
        this.returning.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not return the book',
          detail: this.errorMessage(err),
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
        this.lastPayments.set(payments);
        this.paymentForm.reset();
        this.messageService.add({
          severity: 'success',
          summary: payments.length > 0 ? `${payments.length} payment(s) authorised` : 'No pending payments found',
        });
      },
      error: (err: unknown) => {
        this.authorising.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not authorise payment',
          detail: this.errorMessage(err),
        });
      },
    });
  }

  /** Days remaining until due (negative = days overdue) - "tracking the days" on a loan. */
  daysUntilDue(record: BorrowingRecord): number {
    return Math.ceil((new Date(record.dueDate).getTime() - Date.now()) / MS_PER_DAY);
  }

  private errorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return (err.error as { message?: string } | null)?.message ?? 'Please try again.';
    }
    return 'Please try again.';
  }
}

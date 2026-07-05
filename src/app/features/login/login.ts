import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../core/services/auth.service';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, CardModule, InputTextModule, PasswordModule, ButtonModule, MessageModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<Mode>('login');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  readonly registerForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    fullName: ['', Validators.required],
    phone: [''],
    address: [''],
  });

  switchMode(mode: Mode): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
  }

  submitLogin(): void {
    if (this.loginForm.invalid || this.submitting()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.getRawValue()).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.router.navigateByUrl(this.authService.defaultRouteForRole(response.role));
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(this.extractErrorMessage(err, 'Invalid username or password.'));
      },
    });
  }

  submitRegister(): void {
    if (this.registerForm.invalid || this.submitting()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const { phone, address, ...rest } = this.registerForm.getRawValue();
    this.authService
      .register({
        ...rest,
        ...(phone ? { phone } : {}),
        ...(address ? { address } : {}),
      })
      .subscribe({
        // Account created, but not logged in - send them back to the login form to sign in
        // themselves rather than trusting the register response as a session.
        next: () => {
          this.submitting.set(false);
          this.registerForm.reset();
          this.mode.set('login');
          this.errorMessage.set(null);
          this.infoMessage.set('Account created - please log in.');
          this.loginForm.patchValue({ username: rest.username });
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.extractErrorMessage(err, 'Could not create the account.'));
        },
      });
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const message = (err.error as { message?: string } | null)?.message;
      if (message) return message;
    }
    return fallback;
  }
}

import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  selector: 'app-reset-password',
  styleUrl: './reset-password.scss',
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  readonly token: string;
  readonly passwordForm;
  readonly apiUrl: string;
  isSubmitting = false;
  canRequestNewLink = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly http: HttpClient,
    route: ActivatedRoute,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.token = route.snapshot.queryParamMap.get('token') ?? '';
    const backendUrl = isPlatformBrowser(platformId)
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'http://backend:3001';
    this.apiUrl = `${backendUrl}/api`;
    this.passwordForm = this.formBuilder.nonNullable.group({
      password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
    });
  }

  resetPassword(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.canRequestNewLink = false;
    if (!this.token) {
      this.errorMessage = 'El enlace no contiene un token válido. Solicita uno nuevo.';
      this.canRequestNewLink = true;
      return;
    }
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.http
      .post<{ message: string }>(`${this.apiUrl}/owners/password/reset`, {
        token: this.token,
        ...this.passwordForm.getRawValue(),
      })
      .subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.successMessage = response.message;
          this.passwordForm.reset();
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting = false;
          const message = error.error?.message;
          this.errorMessage = Array.isArray(message)
            ? message.join(' ')
            : message || 'No se pudo actualizar la contraseña. Intenta de nuevo.';
          this.canRequestNewLink = error.status === 404;
        },
      });
  }
}

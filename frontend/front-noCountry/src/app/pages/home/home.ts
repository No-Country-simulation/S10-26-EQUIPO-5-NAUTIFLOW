import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, Inject, PLATFORM_ID } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

interface OwnerResponse {
  id: string;
  fullName: string;
  email: string;
}

interface BoatResponse {
  id: string;
  name: string;
  registrationNumber: string;
}

type OwnerForm = FormGroup<{
  fullName: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  password: FormControl<string>;
}>;

type BoatForm = FormGroup<{
  registrationNumber: FormControl<string>;
  name: FormControl<string>;
  passengerCapacity: FormControl<number>;
  coverageZone: FormControl<string>;
}>;

@Component({
  imports: [CommonModule, ReactiveFormsModule],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {
  private readonly apiUrl: string;
  currentStep = 1;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';
  registeredOwner?: OwnerResponse;

  readonly ownerForm!: OwnerForm;
  readonly boatForm!: BoatForm;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly http: HttpClient,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.apiUrl = isPlatformBrowser(platformId)
      ? `${window.location.protocol}//${window.location.hostname}:3001/api`
      : 'http://backend:3001/api';
    this.ownerForm = this.formBuilder.nonNullable.group({
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
      phone: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(30)]],
      password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
    });
    this.boatForm = this.formBuilder.nonNullable.group({
      registrationNumber: ['', [Validators.required, Validators.maxLength(30)]],
      name: ['', [Validators.required, Validators.maxLength(120)]],
      passengerCapacity: [1, [Validators.required, Validators.min(1), Validators.max(200)]],
      coverageZone: ['', [Validators.required, Validators.maxLength(120)]],
    });
  }

  registerOwner(): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (this.ownerForm.invalid) {
      this.ownerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.http.post<OwnerResponse>(`${this.apiUrl}/owners/register`, this.ownerForm.getRawValue())
      .subscribe({
        next: (owner) => {
          this.registeredOwner = owner;
          this.currentStep = 2;
          this.isSubmitting = false;
        },
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
  }

  registerBoat(): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (!this.registeredOwner || this.boatForm.invalid) {
      this.boatForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.http.post<BoatResponse>(`${this.apiUrl}/boats`, {
      ownerId: this.registeredOwner.id,
      ...this.boatForm.getRawValue(),
    }).subscribe({
      next: (boat) => {
        this.successMessage = `La lancha ${boat.name} fue registrada correctamente.`;
        this.isSubmitting = false;
        this.boatForm.reset({
          registrationNumber: '',
          name: '',
          passengerCapacity: 1,
          coverageZone: '',
        });
      },
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  private handleError(error: HttpErrorResponse): void {
    this.isSubmitting = false;
    const message = error.error?.message;
    this.errorMessage = Array.isArray(message)
      ? message.join(' ')
      : message || 'No se pudo completar la operación. Verifica la conexión con el backend.';
  }
}

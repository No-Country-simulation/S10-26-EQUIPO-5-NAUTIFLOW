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
import { BoatsService } from '../../core/services/boat.service';

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

type DocumentType = 'license' | 'insurance' | 'criminalRecord';
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
type LoginForm = FormGroup<{
  email: FormControl<string>;
  password: FormControl<string>;
}>;
type ForgotForm = FormGroup<{ email: FormControl<string> }>;

@Component({
  imports: [CommonModule, ReactiveFormsModule],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {
  private readonly apiUrl: string;
  private readonly isBrowser: boolean;
  currentStep = 1;
  activeModal: 'login' | 'forgot' | 'register' | null = null;
  isSubmitting = false;
  isLoginSubmitting = false;
  isForgotSubmitting = false;
  errorMessage = '';
  successMessage = '';
  loginError = '';
  loginSuccess = '';
  forgotError = '';
  forgotSuccess = '';
  registeredOwner?: OwnerResponse;
  registeredBoat?: BoatResponse;
  showDocumentsModal = false;
  isUploadingDocuments = false;
  documentsError = '';
  documentsSuccess = '';
  imageError = '';
  selectedImage?: File;
  selectedDocuments: Partial<Record<DocumentType, File>> = {};
  readonly documentTypes: { key: DocumentType; label: string }[] = [
    { key: 'license', label: 'Licencia náutica' },
    { key: 'insurance', label: 'Seguro de la embarcación' },
    { key: 'criminalRecord', label: 'Antecedentes penales' },
  ];

  readonly ownerForm: OwnerForm;
  readonly boatForm: BoatForm;
  readonly loginForm: LoginForm;
  readonly forgotForm: ForgotForm;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly http: HttpClient,
    private readonly boatsService: BoatsService,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.apiUrl = this.isBrowser
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
    this.loginForm = this.formBuilder.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(12)]],
    });
    this.forgotForm = this.formBuilder.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  openRegistration(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.activeModal = 'register';
  }

  openLogin(): void {
    this.loginError = '';
    this.loginSuccess = '';
    this.activeModal = 'login';
  }

  openForgot(): void {
    this.loginError = '';
    this.forgotError = '';
    this.forgotSuccess = '';
    this.activeModal = 'forgot';
  }

  closeModal(): void {
    if (!this.isSubmitting && !this.isLoginSubmitting && !this.isForgotSubmitting) {
      this.activeModal = null;
    }
  }

  registerOwner(): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (this.ownerForm.invalid) {
      this.ownerForm.markAllAsTouched();
      this.errorMessage = 'Revisa los campos marcados antes de continuar.';
      return;
    }
    this.isSubmitting = true;
    this.http.post<OwnerResponse>(`${this.apiUrl}/owners/register`, this.ownerForm.getRawValue()).subscribe({
      next: (owner) => {
        this.registeredOwner = owner;
        this.currentStep = 2;
        this.isSubmitting = false;
        this.successMessage = 'Datos cargados exitosamente. Ahora registra tu lancha.';
      },
      error: (error: HttpErrorResponse) => this.handleError(error, this.ownerForm),
    });
  }

  registerBoat(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.imageError = '';
    if (!this.registeredOwner) {
      this.errorMessage = 'Primero debes completar el registro del lanchero.';
      return;
    }
    if (this.boatForm.invalid) {
      this.boatForm.markAllAsTouched();
      this.errorMessage = 'Revisa los campos marcados antes de registrar la lancha.';
      return;
    }
    this.isSubmitting = true;
    this.http.post<BoatResponse>(`${this.apiUrl}/boats`, {
      ownerId: this.registeredOwner.id,
      ...this.boatForm.getRawValue(),
    }).subscribe({
      next: (boat) => {
        this.registeredBoat = boat;
        if (!this.selectedImage) {
          this.isSubmitting = false;
          this.successMessage = `La lancha ${boat.name} fue registrada exitosamente. Ya puedes cargar su documentación.`;
          return;
        }

        this.boatsService.uploadImage(boat.id, this.selectedImage).subscribe({
          next: (updatedBoat) => {
            this.registeredBoat = updatedBoat;
            this.isSubmitting = false;
            this.successMessage = `La lancha ${boat.name} y su imagen fueron cargadas exitosamente. Ya puedes cargar su documentación.`;
          },
          error: (error: HttpErrorResponse) => {
            this.isSubmitting = false;
            this.imageError = `La lancha fue registrada, pero no se pudo cargar la imagen: ${this.messageFromError(error)}`;
            this.successMessage = `La lancha ${boat.name} fue registrada exitosamente.`;
          },
        });
      },
      error: (error: HttpErrorResponse) => this.handleError(error, this.boatForm),
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.imageError = '';
    this.selectedImage = undefined;

    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.imageError = 'La imagen debe ser JPG, PNG o WEBP.';
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.imageError = 'La imagen no puede superar los 5 MB.';
      input.value = '';
      return;
    }

    this.selectedImage = file;
  }

  login(): void {
    this.loginError = '';
    this.loginSuccess = '';
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginError = 'Ingresa un email y una contraseña válidos.';
      return;
    }
    this.isLoginSubmitting = true;
    this.http.post<{ accessToken: string; admin?: { role?: string } }>(`${this.apiUrl}/auth/login`, this.loginForm.getRawValue()).subscribe({
      next: (response) => {
        this.isLoginSubmitting = false;
        if (this.isBrowser) {
          localStorage.setItem('nautiflow_access_token', response.accessToken);
          localStorage.setItem('nautiflow_role', response.admin?.role ?? 'admin');
        }
        this.loginSuccess = 'Inicio de sesión exitoso.';
        this.loginForm.reset();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoginSubmitting = false;
        this.applyServerError(this.loginForm, this.messageFromError(error));
        this.loginError = this.messageFromError(error);
      },
    });
  }

  requestPasswordReset(): void {
    this.forgotError = '';
    this.forgotSuccess = '';
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      this.forgotError = 'Ingresa un email válido.';
      return;
    }
    this.isForgotSubmitting = true;
    this.http.post<{ message: string }>(`${this.apiUrl}/owners/password/forgot`, this.forgotForm.getRawValue()).subscribe({
      next: (response) => {
        this.isForgotSubmitting = false;
        this.forgotSuccess = response.message;
        this.forgotForm.reset();
      },
      error: (error: HttpErrorResponse) => {
        this.isForgotSubmitting = false;
        this.applyServerError(this.forgotForm, this.messageFromError(error));
        this.forgotError = this.messageFromError(error);
      },
    });
  }

  openDocumentsModal(): void {
    this.activeModal = null;
    this.documentsError = '';
    this.documentsSuccess = '';
    this.showDocumentsModal = true;
  }

  closeDocumentsModal(): void {
    if (!this.isUploadingDocuments) this.showDocumentsModal = false;
  }

  onDocumentSelected(type: DocumentType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.documentsError = 'El archivo debe ser PDF, JPG, JPEG o PNG y pesar hasta 5 MB.';
      input.value = '';
      return;
    }
    this.documentsError = '';
    this.selectedDocuments[type] = file;
  }

  uploadDocuments(): void {
    this.documentsError = '';
    this.documentsSuccess = '';
    if (!this.registeredBoat) {
      this.documentsError = 'Primero debes registrar una lancha.';
      return;
    }
    const missing = this.documentTypes.find(({ key }) => !this.selectedDocuments[key]);
    if (missing) {
      this.documentsError = `Selecciona el archivo de: ${missing.label}.`;
      return;
    }
    const formData = new FormData();
    this.documentTypes.forEach(({ key }) => formData.append(key, this.selectedDocuments[key]!));
    this.isUploadingDocuments = true;
    this.boatsService.uploadDocuments(this.registeredBoat.id, formData).subscribe({
      next: () => {
        this.isUploadingDocuments = false;
        this.documentsSuccess = 'Archivos cargados exitosamente. Quedaron pendientes de revisión.';
        this.successMessage = 'La lancha y su documentación fueron registradas exitosamente.';
      },
      error: (error: HttpErrorResponse) => {
        this.isUploadingDocuments = false;
        this.documentsError = this.messageFromError(error);
      },
    });
  }

  formatFileSize(file: File | undefined): string {
    return file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '';
  }

  private handleError(error: HttpErrorResponse, form: FormGroup): void {
    this.isSubmitting = false;
    const message = this.messageFromError(error);
    this.applyServerError(form, message);
    this.errorMessage = message;
  }

  private messageFromError(error: HttpErrorResponse): string {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || 'No se pudo completar la operación. Verifica la conexión con el backend.';
  }

  private applyServerError(form: FormGroup, message: string): void {
    const lowerMessage = message.toLowerCase();
    const matched = Object.keys(form.controls).filter((name) =>
      lowerMessage.includes(name.toLowerCase()) ||
      (name === 'registrationNumber' && lowerMessage.includes('matrícula')) ||
      (name === 'password' && lowerMessage.includes('contraseña')) ||
      (name === 'email' && lowerMessage.includes('correo')),
    );
    const names = matched.length ? matched : Object.keys(form.controls);
    names.forEach((name) => {
      const control = form.get(name);
      control?.setErrors({ ...(control.errors ?? {}), server: true });
      control?.markAsTouched();
    });
  }
}

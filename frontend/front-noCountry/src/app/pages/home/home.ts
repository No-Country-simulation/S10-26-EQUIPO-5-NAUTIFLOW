import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, Inject, PLATFORM_ID } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BoatsService } from '../../core/services/boat.service';
import type {
  Boat,
  BoatDocument,
  BoatSearchFilters,
} from '../../core/services/boat.service';

interface OwnerResponse {
  id: string;
  fullName: string;
  email: string;
}

interface BoatResponse {
  id: string;
  name: string;
  registrationNumber: string;
  documents?: BoatDocument[];
}

interface AccountResponse {
  accessToken: string;
  user?: AccountUser;
  admin?: AccountUser;
}

interface AccountUser {
  id: string;
  fullName: string;
  email: string;
  role?: string;
}

interface PassengerResponse {
  id: string;
  fullName: string;
  email: string;
}

interface PassengerFeedback {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface PassengerBooking {
  id: string;
  createdAt: string;
  feedback: PassengerFeedback | null;
  boat: Boat;
}

interface AdminBoat extends Boat {
  owner?: { fullName: string; email: string };
}

type DocumentType = 'license' | 'insurance' | 'criminalRecord';
type OwnerForm = FormGroup<{
  fullName: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  password: FormControl<string>;
}>;
type PassengerForm = FormGroup<{
  fullName: FormControl<string>;
  email: FormControl<string>;
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {
  private readonly apiUrl: string;
  private readonly isBrowser: boolean;
  currentStep = 1;
  registrationRole: 'owner' | 'passenger' = 'owner';
  activeModal: 'login' | 'forgot' | 'register' | null = null;
  isSubmitting = false;
  isLoginSubmitting = false;
  isForgotSubmitting = false;
  errorMessage = '';
  successMessage = '';
  loginError = '';
  loginSuccess = '';
  authSuccessMessage = '';
  showOwnerPassword = false;
  showPassengerPassword = false;
  showLoginPassword = false;
  forgotError = '';
  forgotSuccess = '';
  registeredOwner?: OwnerResponse;
  registeredBoat?: BoatResponse;
  currentUser?: AccountUser;
  userRole: 'owner' | 'admin' | 'passenger' | null = null;
  loginRole: 'owner' | 'admin' | 'passenger' = 'owner';
  myBoats: Boat[] = [];
  availableBoats: Boat[] = [];
  filteredAvailableBoats: Boat[] = [];
  isLoadingAvailableBoats = false;
  catalogError = '';
  pendingBoats: AdminBoat[] = [];
  documentedCapacities: Record<string, number | null> = {};
  verifyingBoatId: string | null = null;
  accountSuccess = '';
  adminOwners: { id: string; fullName: string; email: string }[] = [];
  accountError = '';
  passengerSearch = '';
  minPassengerCapacity: number | null = null;
  coverageZoneFilter = '';
  availabilityFilter: 'all' | 'available' | 'unavailable' = 'all';
  passengerBookings: PassengerBooking[] = [];
  bookingError = '';
  bookingSuccess = '';
  feedbackDrafts: Record<string, { rating: number; comment: string }> = {};
  reservingBoatId: string | null = null;
  submittingFeedbackId: string | null = null;
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
  readonly passengerForm: PassengerForm;
  readonly boatForm: BoatForm;
  readonly loginForm: LoginForm;
  readonly forgotForm: ForgotForm;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly http: HttpClient,
    private readonly boatsService: BoatsService,
    route: ActivatedRoute,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.apiUrl = this.isBrowser
      ? `${window.location.protocol}//${window.location.hostname}:3001/api`
      : 'http://backend:3001/api';
    if (this.isBrowser) {
      this.restoreSession();
    }
    if (this.isBrowser) this.loadAvailableBoats();
    this.ownerForm = this.formBuilder.nonNullable.group({
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.pattern(
            /^[A-Z0-9._%+-]+@(gmail\.com|hotmail\.com|outlook\.com)$/i,
          ),
          Validators.maxLength(320),
        ],
      ],
      phone: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(30)]],
      password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
    });
    this.passengerForm = this.formBuilder.nonNullable.group({
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
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
    if (route.snapshot.queryParamMap.get('forgot') === '1') {
      this.openForgot();
    }
  }

  openRegistration(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.authSuccessMessage = '';
    this.registrationRole = 'owner';
    this.activeModal = 'register';
  }

  selectRegistrationRole(role: 'owner' | 'passenger'): void {
    this.registrationRole = role;
    this.errorMessage = '';
    this.successMessage = '';
  }

  openLogin(): void {
    this.loginError = '';
    this.loginSuccess = '';
    this.authSuccessMessage = '';
    this.activeModal = 'login';
  }

  openPassengerLogin(): void {
    this.loginRole = 'passenger';
    this.openLogin();
  }

  toggleOwnerPasswordVisibility(): void {
    this.showOwnerPassword = !this.showOwnerPassword;
  }

  togglePassengerPasswordVisibility(): void {
    this.showPassengerPassword = !this.showPassengerPassword;
  }

  toggleLoginPasswordVisibility(): void {
    this.showLoginPassword = !this.showLoginPassword;
  }

  dismissAuthSuccess(): void {
    this.authSuccessMessage = '';
  }

  selectLoginRole(role: 'owner' | 'admin' | 'passenger'): void {
    this.loginRole = role;
    this.loginError = '';
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
    if (this.isSubmitting) return;
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
        this.successMessage =
          'Registro de lanchero exitoso. Ahora registra tu lancha.';
      },
      error: (error: HttpErrorResponse) => this.handleError(error, this.ownerForm),
    });
  }

  registerPassenger(): void {
    if (this.isSubmitting) return;
    this.errorMessage = '';
    if (this.passengerForm.invalid) {
      this.passengerForm.markAllAsTouched();
      this.errorMessage = 'Revisa los campos marcados antes de continuar.';
      return;
    }

    const passengerCredentials = this.passengerForm.getRawValue();
    this.isSubmitting = true;
    this.http
      .post<PassengerResponse>(
        `${this.apiUrl}/passengers/register`,
        passengerCredentials,
      )
      .subscribe({
        next: () => {
          this.http
            .post<AccountResponse>(
              `${this.apiUrl}/auth/passenger-login`,
              {
                email: passengerCredentials.email,
                password: passengerCredentials.password,
              },
            )
            .subscribe({
              next: (response) => {
                this.isSubmitting = false;
                this.passengerForm.reset();
                this.completeLogin(
                  response,
                  'passenger',
                  'Cuenta de pasajero creada. ¡Bienvenido!',
                );
              },
              error: (error: HttpErrorResponse) => {
                this.isSubmitting = false;
                this.loginRole = 'passenger';
                this.loginForm.setValue({
                  email: passengerCredentials.email,
                  password: passengerCredentials.password,
                });
                this.activeModal = 'login';
                this.loginError = `La cuenta se creó, pero no se pudo iniciar sesión: ${this.messageFromError(error)}`;
              },
            });
        },
        error: (error: HttpErrorResponse) =>
          this.handleError(error, this.passengerForm),
      });
  }

  registerBoat(): void {
    if (this.isSubmitting) return;
    if (this.registeredBoat && this.registeredOwner) {
      this.currentStep = 3;
      return;
    }
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
          this.continueToDocuments(boat);
          return;
        }

        this.boatsService.uploadImage(boat.id, this.selectedImage).subscribe({
          next: (updatedBoat) => {
            this.registeredBoat = updatedBoat;
            this.continueToDocuments(boat, true);
          },
          error: (error: HttpErrorResponse) => {
            this.imageError = `La lancha fue registrada, pero no se pudo cargar la imagen: ${this.messageFromError(error)}`;
            this.continueToDocuments(boat);
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
    const endpoint = {
      admin: 'login',
      owner: 'owner-login',
      passenger: 'passenger-login',
    }[this.loginRole];
    this.http.post<AccountResponse>(`${this.apiUrl}/auth/${endpoint}`, this.loginForm.getRawValue()).subscribe({
      next: (response) => {
        this.isLoginSubmitting = false;
        this.completeLogin(response, this.loginRole, 'Inicio de sesión exitoso.');
        this.loginForm.reset();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoginSubmitting = false;
        this.applyServerError(this.loginForm, this.messageFromError(error));
        this.loginError = this.messageFromError(error);
      },
    });
  }

  private completeLogin(
    response: AccountResponse,
    role: 'owner' | 'admin' | 'passenger',
    message: string,
  ): void {
    const account = response.user ?? response.admin;
    if (!account) {
      this.loginError = 'La respuesta de autenticación no contiene la cuenta.';
      return;
    }
    if (this.isBrowser) {
      localStorage.setItem('nautiflow_access_token', response.accessToken);
      localStorage.setItem('nautiflow_role', role);
      localStorage.setItem('nautiflow_user', JSON.stringify(account));
    }
    this.currentUser = account;
    this.userRole = role;
    this.loadAccountData();
    this.loginSuccess = message;
    this.authSuccessMessage = message;
    this.activeModal = null;
  }

  logout(): void {
    this.authSuccessMessage = '';
    if (this.isBrowser) {
      localStorage.removeItem('nautiflow_access_token');
      localStorage.removeItem('nautiflow_role');
      localStorage.removeItem('nautiflow_user');
    }
    this.currentUser = undefined;
    this.userRole = null;
    this.myBoats = [];
    this.passengerBookings = [];
    this.pendingBoats = [];
    this.adminOwners = [];
  }

  filterAvailableBoats(): void {
    const search = this.passengerSearch.trim().toLowerCase();
    this.filteredAvailableBoats = search
      ? this.availableBoats.filter((boat) =>
          `${boat.name} ${boat.coverageZone} ${boat.owner?.fullName ?? ''}`
            .toLowerCase()
            .includes(search),
        )
      : this.availableBoats;
  }

  searchAvailableBoats(): void {
    const filters: BoatSearchFilters = {};
    if (this.minPassengerCapacity !== null) {
      filters.minCapacity = this.minPassengerCapacity;
    }
    if (this.coverageZoneFilter.trim()) {
      filters.zone = this.coverageZoneFilter.trim();
    }
    if (this.availabilityFilter !== 'all') {
      filters.availability = this.availabilityFilter;
    }
    this.loadAvailableBoats(filters);
  }

  trackById<T extends { id: string }>(_index: number, item: T): string {
    return item.id;
  }

  hasBookingForBoat(boatId: string): boolean {
    return this.passengerBookings.some((booking) => booking.boat.id === boatId);
  }

  registerForBoat(boat: Boat): void {
    if (this.userRole !== 'passenger') {
      this.openPassengerLogin();
      return;
    }
    if (this.hasBookingForBoat(boat.id)) return;
    if (boat.availablePassengerCapacity < 1) {
      this.bookingError = 'La embarcación ya no tiene plazas disponibles.';
      return;
    }

    const token = this.getAccessToken();
    if (!token) {
      this.openPassengerLogin();
      return;
    }

    this.bookingError = '';
    this.bookingSuccess = '';
    this.reservingBoatId = boat.id;
    this.http
      .post<PassengerBooking>(
        `${this.apiUrl}/passengers/boats/${boat.id}/register`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.reservingBoatId = null;
          this.bookingSuccess = `Tu plaza en ${boat.name} quedó registrada.`;
          this.searchAvailableBoats();
          this.loadPassengerBookings();
        },
        error: (error: HttpErrorResponse) => {
          this.reservingBoatId = null;
          this.bookingError = this.messageFromError(error);
          this.searchAvailableBoats();
        },
      });
  }

  submitFeedback(bookingId: string): void {
    const draft = this.feedbackDrafts[bookingId];
    const token = this.getAccessToken();
    if (!draft || !token || !Number.isInteger(draft.rating)) return;

    this.bookingError = '';
    this.bookingSuccess = '';
    this.submittingFeedbackId = bookingId;
    this.http
      .post<PassengerFeedback>(
        `${this.apiUrl}/passengers/bookings/${bookingId}/feedback`,
        { rating: draft.rating, comment: draft.comment },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.submittingFeedbackId = null;
          this.bookingSuccess = 'Gracias por compartir tu opinión del lanchero.';
          this.loadPassengerBookings();
          this.searchAvailableBoats();
        },
        error: (error: HttpErrorResponse) => {
          this.submittingFeedbackId = null;
          this.bookingError = this.messageFromError(error);
        },
      });
  }

  verifyBoat(boatId: string, status: 'approved' | 'rejected'): void {
    if (this.verifyingBoatId) return;
    const token = this.getAccessToken();
    if (!token) {
      this.accountError = 'Inicia sesión como administrador para revisar embarcaciones.';
      return;
    }
    const documentedPassengerCapacity = this.documentedCapacities[boatId];
    if (
      status === 'approved' &&
      (documentedPassengerCapacity === null ||
        documentedPassengerCapacity === undefined)
    ) {
      this.accountError =
        'Ingresa la capacidad que figura en la licencia antes de aprobar.';
      return;
    }
    this.accountError = '';
    this.accountSuccess = '';
    this.verifyingBoatId = boatId;
    this.http.patch<AdminBoat>(`${this.apiUrl}/admin/boats/${boatId}/verification`, {
      status,
      reason: status === 'rejected' ? 'Documentación incompleta o inválida.' : undefined,
      documentedPassengerCapacity: documentedPassengerCapacity ?? undefined,
    }, { headers: { Authorization: `Bearer ${token}` } }).subscribe({
      next: () => {
        this.pendingBoats = this.pendingBoats.filter((boat) => boat.id !== boatId);
        this.accountSuccess =
          status === 'approved'
            ? 'Embarcación aprobada y publicada en el catálogo.'
            : 'Revisión de la embarcación rechazada.';
        this.verifyingBoatId = null;
        this.loadAdminData();
        if (status === 'approved') this.searchAvailableBoats();
      },
      error: (error: HttpErrorResponse) => {
        this.verifyingBoatId = null;
        this.accountError = this.messageFromError(error);
      },
    });
  }

  hasLicenseDocument(boat: AdminBoat): boolean {
    return Boolean(
      boat.documents?.some((document) => document.type === 'license'),
    );
  }

  canApproveBoat(boat: AdminBoat): boolean {
    return (
      this.hasLicenseDocument(boat) &&
      this.documentedCapacities[boat.id] !== null &&
      this.documentedCapacities[boat.id] !== undefined
    );
  }

  capacityDiffersFromLicense(boat: AdminBoat): boolean {
    const documentedCapacity = this.documentedCapacities[boat.id];
    return (
      documentedCapacity !== null &&
      documentedCapacity !== undefined &&
      documentedCapacity !== boat.passengerCapacity
    );
  }

  setDocumentedCapacity(boatId: string, value: string | number): void {
    const capacity = Number(value);
    this.documentedCapacities[boatId] =
      value === '' ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 200
        ? null
        : capacity;
  }

  private restoreSession(): void {
    const role = localStorage.getItem('nautiflow_role');
    const accessToken = localStorage.getItem('nautiflow_access_token');
    const serializedUser = localStorage.getItem('nautiflow_user');
    if (
      !accessToken ||
      (role !== 'owner' && role !== 'admin' && role !== 'passenger')
    )
      return;
    this.userRole = role;
    if (serializedUser) {
      try {
        this.currentUser = JSON.parse(serializedUser) as NonNullable<typeof this.currentUser>;
      } catch {
        localStorage.removeItem('nautiflow_user');
      }
    }
    this.loadAccountData();
  }

  private getAccessToken(): string | null {
    return this.isBrowser ? localStorage.getItem('nautiflow_access_token') : null;
  }

  private loadAccountData(): void {
    const token = this.getAccessToken();
    if (!token) return;
    if (this.userRole === 'owner') {
      this.boatsService.listMine(token).subscribe({
        next: (boats) => this.myBoats = boats,
        error: (error: HttpErrorResponse) => this.accountError = this.messageFromError(error),
      });
    } else if (this.userRole === 'admin') {
      this.loadAdminData();
    } else if (this.userRole === 'passenger') {
      this.loadPassengerBookings();
    }
  }

  private loadPassengerBookings(): void {
    const token = this.getAccessToken();
    if (!token) return;
    this.http
      .get<PassengerBooking[]>(`${this.apiUrl}/passengers/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (bookings) => {
          this.passengerBookings = bookings;
          for (const booking of bookings) {
            this.feedbackDrafts[booking.id] ??= { rating: 5, comment: '' };
          }
        },
        error: (error: HttpErrorResponse) => {
          this.bookingError = this.messageFromError(error);
        },
      });
  }

  private loadAdminData(): void {
    const token = this.getAccessToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    this.http.get<AdminBoat[]>(`${this.apiUrl}/admin/boats/pending`, { headers }).subscribe({
      next: (boats) => this.pendingBoats = boats,
      error: (error: HttpErrorResponse) => this.accountError = this.messageFromError(error),
    });
    this.http.get<{ id: string; fullName: string; email: string }[]>(`${this.apiUrl}/admin/owners`, { headers }).subscribe({
      next: (owners) => this.adminOwners = owners,
      error: (error: HttpErrorResponse) => this.accountError = this.messageFromError(error),
    });
  }

  private loadAvailableBoats(filters: BoatSearchFilters = {}): void {
    this.isLoadingAvailableBoats = true;
    this.catalogError = '';
    this.boatsService.listAvailable(filters).subscribe({
      next: (boats) => {
        this.availableBoats = boats;
        this.filterAvailableBoats();
        this.isLoadingAvailableBoats = false;
      },
      error: (error: HttpErrorResponse) => {
        this.availableBoats = [];
        this.filteredAvailableBoats = [];
        this.catalogError = this.messageFromError(error);
        this.isLoadingAvailableBoats = false;
      },
    });
  }

  retryAvailableBoats(): void {
    this.searchAvailableBoats();
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
    if (this.isUploadingDocuments) return;
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
      next: (documents) => {
        this.isUploadingDocuments = false;
        this.documentsSuccess = 'Archivos cargados exitosamente. Quedaron pendientes de revisión.';
        this.refreshOwnerBoatDocuments(documents);
        if (
          this.activeModal === 'register' &&
          this.registrationRole === 'owner' &&
          this.currentStep === 3
        ) {
          this.currentStep = 4;
        }
        this.selectedDocuments = {};
        if (this.isBrowser && this.showDocumentsModal) {
          this.documentTypes.forEach(({ key }) => {
            const input = document.getElementById(`document-${key}`) as HTMLInputElement | null;
            if (input) input.value = '';
          });
        }
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

  documentLabel(type: BoatDocument['type']): string {
    return this.documentTypes.find((document) => document.key === type)?.label ?? type;
  }

  finishOwnerRegistration(): void {
    this.activeModal = null;
    this.currentStep = 1;
    this.registeredOwner = undefined;
    this.registeredBoat = undefined;
    this.ownerForm.reset();
    this.boatForm.reset();
    this.selectedImage = undefined;
    this.selectedDocuments = {};
    this.errorMessage = '';
    this.successMessage = '';
    this.documentsSuccess = '';
    this.imageError = '';
  }

  private continueToDocuments(boat: BoatResponse, imageUploaded = false): void {
    this.isSubmitting = false;
    this.currentStep = 3;
    this.successMessage = imageUploaded
      ? `La lancha ${boat.name} y su imagen fueron cargadas. Ahora carga la documentación requerida.`
      : `La lancha ${boat.name} fue registrada. Ahora carga la documentación requerida.`;
  }

  private refreshOwnerBoatDocuments(documents: BoatDocument[]): void {
    if (!this.registeredBoat) return;

    this.registeredBoat = { ...this.registeredBoat, documents };
    this.myBoats = this.myBoats.map((boat) =>
      boat.id === this.registeredBoat?.id ? { ...boat, documents } : boat,
    );
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

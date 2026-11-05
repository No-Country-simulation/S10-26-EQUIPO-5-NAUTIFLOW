import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Component, DestroyRef, Inject, PLATFORM_ID, inject } from '@angular/core';
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

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'owner';
  createdAt: string;
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

interface ReviewFeedback {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface AdminBoat extends Boat {
  owner?: { fullName: string; email: string };
}

interface AdminFleetBoat {
  id: string;
  name: string;
  registrationNumber: string;
  passengerCapacity: number;
  availablePassengerCapacity: number;
  coverageZone: string;
  owner: { fullName: string; phone: string | null };
  availabilityWindows: { startsAt: string; endsAt: string }[];
}

interface FleetSearchResult extends AdminFleetBoat {
  availabilityWindows: { startsAt: string; endsAt: string }[];
}

interface EmptyLeg {
  id: string;
  origin: string;
  destination: string;
  returnsAt: string;
  boat: {
    id: string;
    name: string;
    owner: { fullName: string; phone: string | null };
  };
}

interface OwnerNotification {
  id: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

interface PublicTrip {
  id: string;
  origin: string;
  destination: string;
  startsAt: string;
  endsAt: string | null;
  isEmptyReturn: boolean;
  boat: {
    id: string;
    name: string;
    passengerCapacity: number;
    imageUrl: string | null;
    owner: { fullName: string; whatsappUrl: string | null };
  };
}

interface AdminTrip {
  id: string;
  origin: string;
  destination: string;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  completedAt: string | null;
  isEmptyReturn: boolean;
  boat: { id: string; name: string };
}

interface ReviewDetails {
  trip: {
    id: string;
    origin: string;
    destination: string;
    completedAt: string;
    boat: { name: string };
  };
  alreadyReviewed: boolean;
}

interface CompletedTrip {
  id: string;
  completedAt: string;
  reviewToken: string;
  reviewTokenExpiresAt: string;
}

type DocumentType = 'license' | 'insurance' | 'criminalRecord';
type SuccessMessageField =
  | 'successMessage'
  | 'loginSuccess'
  | 'authSuccessMessage'
  | 'forgotSuccess'
  | 'accountSuccess'
  | 'tripSuccess'
  | 'operationsSuccess'
  | 'reviewSuccess'
  | 'documentsSuccess';
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl: string;
  private readonly isBrowser: boolean;
  private readonly successTimers = new Map<
    SuccessMessageField,
    ReturnType<typeof setTimeout>
  >();
  currentStep = 1;
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
  showLoginPassword = false;
  forgotError = '';
  forgotSuccess = '';
  registeredOwner?: OwnerResponse;
  registeredBoat?: BoatResponse;
  currentUser?: AccountUser;
  userRole: 'owner' | 'admin' | null = null;
  loginRole: 'owner' | 'admin' = 'owner';
  myBoats: Boat[] = [];
  availableBoats: Boat[] = [];
  filteredAvailableBoats: Boat[] = [];
  isLoadingAvailableBoats = false;
  catalogError = '';
  pendingBoats: AdminBoat[] = [];
  isLoadingPendingBoats = false;
  documentedCapacities: Record<string, number | null> = {};
  verifyingBoatId: string | null = null;
  accountSuccess = '';
  adminUsers: AdminUser[] = [];
  adminUserSearch = '';
  isLoadingAdminUsers = false;
  adminUsersError = '';
  activeFleet: AdminFleetBoat[] = [];
  isLoadingActiveFleet = false;
  fleetSearchResults: FleetSearchResult[] = [];
  hasSearchedFleet = false;
  emptyLegs: EmptyLeg[] = [];
  adminTrips: AdminTrip[] = [];
  isLoadingAdminTrips = false;
  adminTripsError = '';
  publicTrips: PublicTrip[] = [];
  isLoadingPublicTrips = false;
  publicTripsError = '';
  showTripModal = false;
  isCreatingTrip = false;
  completingTripId: string | null = null;
  tripError = '';
  tripSuccess = '';
  tripBoatId = '';
  tripOrigin = '';
  tripDestination = '';
  tripStartsAt = '';
  tripEndsAt = '';
  completedReviewLink = '';
  readonly reviewToken: string | null;
  reviewDetails?: ReviewDetails;
  isLoadingReview = false;
  isSubmittingReview = false;
  reviewRating = 5;
  reviewComment = '';
  reviewError = '';
  reviewSuccess = '';
  ownerNotifications: OwnerNotification[] = [];
  fleetSearchPassengers = 1;
  fleetSearchZone = '';
  fleetAvailableAt = '';
  availabilityBoatId = '';
  availabilityStartsAt = '';
  availabilityEndsAt = '';
  emptyLegBoatId = '';
  emptyLegOrigin = '';
  emptyLegDestination = '';
  emptyLegReturnsAt = '';
  emptyLegAnnouncement = '';
  operationsError = '';
  operationsSuccess = '';
  isSearchingFleet = false;
  isSavingAvailability = false;
  isPublishingEmptyLeg = false;
  accountError = '';
  catalogSearch = '';
  minPassengerCapacity: number | null = null;
  coverageZoneFilter = '';
  availabilityFilter: 'all' | 'available' | 'unavailable' = 'all';
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
    route: ActivatedRoute,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.destroyRef.onDestroy(() => {
      this.successTimers.forEach((timer) => clearTimeout(timer));
      this.successTimers.clear();
    });
    this.isBrowser = isPlatformBrowser(platformId);
    this.apiUrl = this.isBrowser
      ? `${window.location.protocol}//${window.location.hostname}:3001/api`
      : 'http://backend:3001/api';
    if (this.isBrowser) {
      this.restoreSession();
    }
    this.reviewToken = route.snapshot.queryParamMap.get('review');
    if (this.isBrowser) {
      this.loadAvailableBoats();
      this.loadPublicTrips();
      if (this.reviewToken) this.loadReview();
    }
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
    this.setTemporarySuccess('successMessage', '');
    this.setTemporarySuccess('authSuccessMessage', '');
    this.activeModal = 'register';
  }

  openLogin(): void {
    this.loginError = '';
    this.setTemporarySuccess('loginSuccess', '');
    this.setTemporarySuccess('authSuccessMessage', '');
    this.activeModal = 'login';
  }

  toggleOwnerPasswordVisibility(): void {
    this.showOwnerPassword = !this.showOwnerPassword;
  }

  toggleLoginPasswordVisibility(): void {
    this.showLoginPassword = !this.showLoginPassword;
  }

  dismissAuthSuccess(): void {
    this.setTemporarySuccess('authSuccessMessage', '');
  }

  selectLoginRole(role: 'owner' | 'admin'): void {
    if (this.loginRole !== role) {
      this.loginForm.reset();
      this.showLoginPassword = false;
    }
    this.loginRole = role;
    this.loginError = '';
  }

  openForgot(): void {
    this.loginError = '';
    this.forgotError = '';
    this.setTemporarySuccess('forgotSuccess', '');
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
    this.setTemporarySuccess('successMessage', '');
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
        this.setTemporarySuccess(
          'successMessage',
          'Registro de lanchero exitoso. Ahora registra tu lancha.',
        );
      },
      error: (error: HttpErrorResponse) => this.handleError(error, this.ownerForm),
    });
  }

  registerBoat(): void {
    if (this.isSubmitting) return;
    if (this.registeredBoat && this.registeredOwner) {
      this.currentStep = 3;
      return;
    }
    this.errorMessage = '';
    this.setTemporarySuccess('successMessage', '');
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
    this.setTemporarySuccess('loginSuccess', '');
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginError = 'Ingresa un email y una contraseña válidos.';
      return;
    }
    this.isLoginSubmitting = true;
    const endpoint = {
      admin: 'login',
      owner: 'owner-login',
    }[this.loginRole];
    this.http.post<AccountResponse>(`${this.apiUrl}/auth/${endpoint}`, this.loginForm.getRawValue()).subscribe({
      next: (response) => {
        this.isLoginSubmitting = false;
        this.completeLogin(response, this.loginRole, 'Inicio de sesión exitoso.');
        this.loginForm.reset();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoginSubmitting = false;
        const message = this.loginMessageFromError(error);
        this.applyServerError(this.loginForm, message);
        this.loginError = message;
      },
    });
  }

  private completeLogin(
    response: AccountResponse,
    role: 'owner' | 'admin',
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
    this.setTemporarySuccess('loginSuccess', message);
    this.setTemporarySuccess('authSuccessMessage', message);
    this.activeModal = null;
  }

  private setTemporarySuccess(field: SuccessMessageField, message: string): void {
    const previousTimer = this.successTimers.get(field);
    if (previousTimer) clearTimeout(previousTimer);
    this.successTimers.delete(field);
    this[field] = message;

    if (!message || !this.isBrowser) return;

    const timer = setTimeout(() => {
      this[field] = '';
      this.successTimers.delete(field);
    }, 5000);
    this.successTimers.set(field, timer);
  }

  logout(): void {
    this.setTemporarySuccess('authSuccessMessage', '');
    if (this.isBrowser) {
      localStorage.removeItem('nautiflow_access_token');
      localStorage.removeItem('nautiflow_role');
      localStorage.removeItem('nautiflow_user');
    }
    this.currentUser = undefined;
    this.userRole = null;
    this.myBoats = [];
    this.pendingBoats = [];
    this.adminUsers = [];
    this.adminUserSearch = '';
    this.adminUsersError = '';
    this.isLoadingAdminUsers = false;
    this.activeFleet = [];
    this.isLoadingPendingBoats = false;
    this.isLoadingActiveFleet = false;
    this.fleetSearchResults = [];
    this.emptyLegs = [];
    this.adminTrips = [];
    this.isLoadingAdminTrips = false;
    this.adminTripsError = '';
    this.publicTrips = [];
    this.isLoadingPublicTrips = false;
    this.showTripModal = false;
    this.tripBoatId = '';
    this.tripError = '';
    this.completedReviewLink = '';
    this.setTemporarySuccess('tripSuccess', '');
    this.ownerNotifications = [];
    this.emptyLegAnnouncement = '';
  }

  filterAvailableBoats(): void {
    const search = this.catalogSearch.trim().toLowerCase();
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
    this.setTemporarySuccess('accountSuccess', '');
    this.verifyingBoatId = boatId;
    this.http.patch<AdminBoat>(`${this.apiUrl}/admin/boats/${boatId}/verification`, {
      status,
      reason: status === 'rejected' ? 'Documentación incompleta o inválida.' : undefined,
      documentedPassengerCapacity: documentedPassengerCapacity ?? undefined,
    }, { headers: { Authorization: `Bearer ${token}` } }).subscribe({
      next: () => {
        this.pendingBoats = this.pendingBoats.filter((boat) => boat.id !== boatId);
        this.setTemporarySuccess(
          'accountSuccess',
          status === 'approved'
            ? 'Embarcación aprobada y publicada en el catálogo.'
            : 'Revisión de la embarcación rechazada.',
        );
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

  searchAdminFleet(): void {
    const token = this.getAccessToken();
    const availableAt = new Date(this.fleetAvailableAt);
    if (
      !token ||
      !Number.isInteger(this.fleetSearchPassengers) ||
      this.fleetSearchPassengers < 1 ||
      this.fleetSearchPassengers > 200 ||
      !this.fleetAvailableAt ||
      Number.isNaN(availableAt.getTime()) ||
      availableAt <= new Date()
    ) {
      this.operationsError =
        'Indica una cantidad de pasajeros válida y un horario futuro.';
      return;
    }

    this.operationsError = '';
    this.isSearchingFleet = true;
    this.hasSearchedFleet = true;
    let params = new HttpParams()
      .set('minPassengers', this.fleetSearchPassengers)
      .set('availableAt', availableAt.toISOString());
    if (this.fleetSearchZone.trim()) {
      params = params.set('zone', this.fleetSearchZone.trim());
    }
    this.http
      .get<FleetSearchResult[]>(`${this.apiUrl}/admin/fleet/search`, {
        headers: { Authorization: 'Bearer ' + token },
        params,
      })
      .subscribe({
        next: (boats) => {
          this.fleetSearchResults = boats;
          this.isSearchingFleet = false;
        },
        error: (error: HttpErrorResponse) => {
          this.isSearchingFleet = false;
          this.operationsError = this.messageFromError(error);
        },
      });
  }

  saveAvailabilityWindow(): void {
    if (this.isSavingAvailability) return;
    const startsAt = new Date(this.availabilityStartsAt);
    const endsAt = new Date(this.availabilityEndsAt);
    if (
      !this.availabilityBoatId ||
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      startsAt <= new Date() ||
      endsAt <= startsAt
    ) {
      this.operationsError =
        'Elige una lancha y un rango de disponibilidad futuro válido.';
      return;
    }
    const token = this.getAccessToken();
    if (!token) {
      this.operationsError = 'Inicia sesión como administrador.';
      return;
    }

    this.operationsError = '';
    this.setTemporarySuccess('operationsSuccess', '');
    this.isSavingAvailability = true;
    this.http
      .post(
        `${this.apiUrl}/admin/availability`,
        {
          boatId: this.availabilityBoatId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
        { headers: { Authorization: 'Bearer ' + token } },
      )
      .subscribe({
        next: () => {
          this.isSavingAvailability = false;
          this.setTemporarySuccess('operationsSuccess', 'Disponibilidad registrada.');
          this.availabilityStartsAt = '';
          this.availabilityEndsAt = '';
          this.loadActiveFleet({ Authorization: 'Bearer ' + token });
        },
        error: (error: HttpErrorResponse) => {
          this.isSavingAvailability = false;
          this.operationsError = this.messageFromError(error);
        },
      });
  }

  publishEmptyLeg(): void {
    const returnsAt = new Date(this.emptyLegReturnsAt);
    if (
      !this.emptyLegBoatId ||
      !this.emptyLegOrigin.trim() ||
      !this.emptyLegDestination.trim() ||
      Number.isNaN(returnsAt.getTime()) ||
      returnsAt <= new Date()
    ) {
      this.operationsError =
        'Completa la lancha, el trayecto y un horario de regreso futuro.';
      return;
    }
    const boat = this.activeFleet.find(
      (activeBoat) => activeBoat.id === this.emptyLegBoatId,
    );
    if (
      !boat?.availabilityWindows.some(
        (window) =>
          new Date(window.startsAt) <= returnsAt &&
          new Date(window.endsAt) > returnsAt,
      )
    ) {
      this.operationsError =
        'Guarda primero una disponibilidad que cubra el horario del retorno.';
      return;
    }
    const token = this.getAccessToken();
    if (!token) {
      this.operationsError = 'Inicia sesión como administrador.';
      return;
    }

    this.operationsError = '';
    this.setTemporarySuccess('operationsSuccess', '');
    this.isPublishingEmptyLeg = true;
    this.http
      .post<EmptyLeg>(
        `${this.apiUrl}/admin/empty-legs`,
        {
          boatId: this.emptyLegBoatId,
          origin: this.emptyLegOrigin.trim(),
          destination: this.emptyLegDestination.trim(),
          returnsAt: returnsAt.toISOString(),
        },
        { headers: { Authorization: 'Bearer ' + token } },
      )
      .subscribe({
        next: (leg) => {
          this.emptyLegAnnouncement = this.emptyLegMessage(leg);
          this.emptyLegOrigin = '';
          this.emptyLegDestination = '';
          this.emptyLegReturnsAt = '';
          this.setTemporarySuccess(
            'operationsSuccess',
            'Retorno vacío publicado y guardado en el panel.',
          );
          this.isPublishingEmptyLeg = false;
          this.loadEmptyLegs();
          this.loadAdminTrips();
          this.loadPublicTrips();
        },
        error: (error: HttpErrorResponse) => {
          this.isPublishingEmptyLeg = false;
          this.operationsError = this.messageFromError(error);
        },
      });
  }

  openTripModal(): void {
    if (this.userRole !== 'admin') return;
    this.showTripModal = true;
    this.tripError = '';
    this.setTemporarySuccess('tripSuccess', '');
  }

  closeTripModal(): void {
    if (!this.isCreatingTrip) this.showTripModal = false;
  }

  get selectedTripBoat(): AdminFleetBoat | undefined {
    return this.activeFleet.find((boat) => boat.id === this.tripBoatId);
  }

  get tripBoatsWithAvailability(): AdminFleetBoat[] {
    const now = new Date();
    return this.activeFleet.filter((boat) =>
      boat.availabilityWindows.some(
        (window) => new Date(window.endsAt) > now,
      ),
    );
  }

  get selectedTripBoatHasAvailability(): boolean {
    const boat = this.selectedTripBoat;
    const startsAt = new Date(this.tripStartsAt);
    const endsAt = new Date(this.tripEndsAt);
    if (
      !boat ||
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      return false;
    }

    return boat.availabilityWindows.some(
      (window) =>
        new Date(window.startsAt) <= startsAt &&
        new Date(window.endsAt) >= endsAt,
    );
  }

  get filteredAdminAdmins(): AdminUser[] {
    return this.filterAdminUsers('admin');
  }

  get filteredAdminOwners(): AdminUser[] {
    return this.filterAdminUsers('owner');
  }

  private filterAdminUsers(role: AdminUser['role']): AdminUser[] {
    const search = this.adminUserSearch.trim().toLocaleLowerCase();
    return this.adminUsers.filter(
      (user) =>
        user.role === role &&
        (!search ||
          (user.fullName + ' ' + user.email + ' ' + (user.phone || ''))
            .toLocaleLowerCase()
            .includes(search)),
    );
  }

  createTrip(): void {
    const token = this.getAccessToken();
    const boat = this.selectedTripBoat;
    const startsAt = new Date(this.tripStartsAt);
    const endsAt = new Date(this.tripEndsAt);
    if (this.isCreatingTrip) return;
    if (this.userRole !== 'admin' || !token) {
      this.tripError = 'Inicia sesión como administrador para programar un viaje.';
      return;
    }
    if (
      !boat ||
      !this.tripOrigin.trim() ||
      !this.tripDestination.trim() ||
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      startsAt <= new Date() ||
      endsAt <= startsAt
    ) {
      this.tripError = 'Selecciona una lancha y completa el trayecto con un horario futuro válido.';
      return;
    }
    if (!this.selectedTripBoatHasAvailability) {
      this.tripError =
        'Guarda primero una disponibilidad que cubra todo el horario del viaje.';
      return;
    }

    this.tripError = '';
    this.isCreatingTrip = true;
    this.http
      .post<AdminTrip>(
        this.apiUrl + '/admin/trips',
        {
          boatId: boat.id,
          origin: this.tripOrigin.trim(),
          destination: this.tripDestination.trim(),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
        { headers: { Authorization: 'Bearer ' + token } },
      )
      .subscribe({
        next: (trip) => {
          this.isCreatingTrip = false;
          this.tripBoatId = '';
          this.tripOrigin = '';
          this.tripDestination = '';
          this.tripStartsAt = '';
          this.tripEndsAt = '';
          this.setTemporarySuccess(
            'tripSuccess',
            'Viaje publicado para la lancha ' + trip.boat.name + '.',
          );
          this.showTripModal = false;
          this.loadAdminTrips();
          this.loadPublicTrips();
        },
        error: (error: HttpErrorResponse) => {
          this.isCreatingTrip = false;
          this.tripError = this.messageFromError(error);
        },
      });
  }

  completeTrip(trip: AdminTrip): void {
    const token = this.getAccessToken();
    if (!token || this.userRole !== 'admin' || this.completingTripId) return;
    this.tripError = '';
    this.completingTripId = trip.id;
    this.http
      .post<CompletedTrip>(
        this.apiUrl + '/admin/trips/' + trip.id + '/complete',
        {},
        { headers: { Authorization: 'Bearer ' + token } },
      )
      .subscribe({
        next: (completed) => {
          this.completingTripId = null;
          this.completedReviewLink =
            window.location.origin + '/?review=' + encodeURIComponent(completed.reviewToken);
          this.setTemporarySuccess(
            'tripSuccess',
            'Viaje completado. Comparte el enlace de reseña antes del ' +
              new Date(completed.reviewTokenExpiresAt).toLocaleDateString('es-AR') + '.',
          );
          this.loadAdminTrips();
          this.loadPublicTrips();
        },
        error: (error: HttpErrorResponse) => {
          this.completingTripId = null;
          this.tripError = this.messageFromError(error);
        },
      });
  }

  async copyCompletedReviewLink(): Promise<void> {
    if (!this.completedReviewLink || !navigator.clipboard) {
      this.tripError = 'No se pudo acceder al portapapeles. Copia el enlace manualmente.';
      return;
    }
    try {
      await navigator.clipboard.writeText(this.completedReviewLink);
      this.tripError = '';
    } catch {
      this.tripError = 'No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.';
    }
  }

  private loadAdminTrips(): void {
    const token = this.getAccessToken();
    if (!token || this.userRole !== 'admin') return;
    this.isLoadingAdminTrips = true;
    this.adminTripsError = '';
    this.http
      .get<AdminTrip[]>(this.apiUrl + '/admin/trips', {
        headers: { Authorization: 'Bearer ' + token },
      })
      .subscribe({
        next: (trips) => {
          this.adminTrips = trips;
          this.isLoadingAdminTrips = false;
        },
        error: (error: HttpErrorResponse) => {
          this.isLoadingAdminTrips = false;
          this.adminTripsError = this.messageFromError(error);
        },
      });
  }

  private loadPublicTrips(): void {
    this.isLoadingPublicTrips = true;
    this.publicTripsError = '';
    this.http.get<PublicTrip[]>(this.apiUrl + '/trips').subscribe({
      next: (trips) => {
        this.publicTrips = trips;
        this.isLoadingPublicTrips = false;
      },
      error: (error: HttpErrorResponse) => {
        this.publicTrips = [];
        this.isLoadingPublicTrips = false;
        this.publicTripsError = this.messageFromError(error);
      },
    });
  }

  retryPublicTrips(): void {
    this.loadPublicTrips();
  }

  private loadReview(): void {
    if (!this.reviewToken) return;
    this.isLoadingReview = true;
    this.http
      .get<ReviewDetails>(this.apiUrl + '/reviews/' + encodeURIComponent(this.reviewToken))
      .subscribe({
        next: (details) => {
          this.reviewDetails = details;
          this.isLoadingReview = false;
        },
        error: (error: HttpErrorResponse) => {
          this.isLoadingReview = false;
          this.reviewError = this.messageFromError(error);
        },
      });
  }

  submitReview(): void {
    if (
      !this.reviewToken ||
      !this.reviewDetails ||
      this.reviewDetails.alreadyReviewed ||
      this.isSubmittingReview ||
      !Number.isInteger(this.reviewRating) ||
      this.reviewRating < 1 ||
      this.reviewRating > 5
    ) return;

    this.reviewError = '';
    this.setTemporarySuccess('reviewSuccess', '');
    this.isSubmittingReview = true;
    this.http
      .post<ReviewFeedback>(
        this.apiUrl + '/reviews/' + encodeURIComponent(this.reviewToken),
        { rating: this.reviewRating, comment: this.reviewComment.trim() },
      )
      .subscribe({
        next: () => {
          this.isSubmittingReview = false;
          if (this.reviewDetails) this.reviewDetails.alreadyReviewed = true;
          this.reviewComment = '';
          this.setTemporarySuccess('reviewSuccess', 'Gracias por compartir tu experiencia.');
          this.loadAvailableBoats();
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmittingReview = false;
          this.reviewError = this.messageFromError(error);
        },
      });
  }

  async copyEmptyLegMessage(): Promise<void> {
    if (!this.emptyLegAnnouncement || !navigator.clipboard) {
      this.operationsError =
        'No se pudo acceder al portapapeles. Copia el texto manualmente.';
      return;
    }
    try {
      await navigator.clipboard.writeText(this.emptyLegAnnouncement);
      this.setTemporarySuccess(
        'operationsSuccess',
        'Mensaje copiado para compartir con la flota.',
      );
      this.operationsError = '';
    } catch {
      this.operationsError =
        'No se pudo copiar el mensaje. Selecciona y copia el texto manualmente.';
    }
  }

  whatsappNumber(phone: string | null): string {
    return phone?.replace(/\D/g, '') ?? '';
  }

  private emptyLegMessage(leg: EmptyLeg): string {
    const returnTime = new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(leg.returnsAt));
    return `Lancha ${leg.boat.name} vuelve vacía desde la Zona ${leg.origin} hacia ${leg.destination} el ${returnTime}. ¿Alguien necesita un rescate o envío en ese trayecto?`;
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
    if (!accessToken || (role !== 'owner' && role !== 'admin')) return;
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
      this.http
        .get<OwnerNotification[]>(`${this.apiUrl}/owners/notifications`, {
          headers: { Authorization: 'Bearer ' + token },
        })
        .subscribe({
          next: (notifications) => (this.ownerNotifications = notifications),
          error: (error: HttpErrorResponse) =>
            (this.accountError = this.messageFromError(error)),
        });
    } else if (this.userRole === 'admin') {
      this.loadAdminData();
    }
  }

  private loadAdminData(): void {
    const token = this.getAccessToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    this.isLoadingPendingBoats = true;
    this.http.get<AdminBoat[]>(`${this.apiUrl}/admin/boats/pending`, { headers }).subscribe({
      next: (boats) => {
        this.pendingBoats = boats;
        this.isLoadingPendingBoats = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingPendingBoats = false;
        this.accountError = this.messageFromError(error);
      },
    });
    this.loadAdminUsers(headers);
    this.loadActiveFleet(headers);
    this.loadEmptyLegs();
    this.loadAdminTrips();
  }

  private loadActiveFleet(headers: { Authorization: string }): void {
    this.isLoadingActiveFleet = true;
    this.http
      .get<AdminFleetBoat[]>(`${this.apiUrl}/admin/boats/active`, { headers })
      .subscribe({
        next: (boats) => {
          this.activeFleet = boats.map((boat) => ({
            ...boat,
            availabilityWindows: boat.availabilityWindows ?? [],
          }));
          this.isLoadingActiveFleet = false;
        },
        error: (error: HttpErrorResponse) => {
          this.isLoadingActiveFleet = false;
          this.operationsError = this.messageFromError(error);
        },
      });
  }

  private loadAdminUsers(headers: { Authorization: string }): void {
    this.isLoadingAdminUsers = true;
    this.adminUsersError = '';
    this.http
      .get<AdminUser[]>(`${this.apiUrl}/admin/users`, { headers })
      .subscribe({
        next: (users) => {
          this.adminUsers = users;
          this.isLoadingAdminUsers = false;
        },
        error: (error: HttpErrorResponse) => {
          this.adminUsers = [];
          this.isLoadingAdminUsers = false;
          this.adminUsersError = this.messageFromError(error);
        },
      });
  }

  reloadAdminUsers(): void {
    const token = this.getAccessToken();
    if (!token || this.userRole !== 'admin') return;
    this.loadAdminUsers({ Authorization: 'Bearer ' + token });
  }

  private loadEmptyLegs(): void {
    const token = this.getAccessToken();
    if (!token) return;
    this.http
      .get<EmptyLeg[]>(`${this.apiUrl}/admin/empty-legs`, {
        headers: { Authorization: 'Bearer ' + token },
      })
      .subscribe({
        next: (legs) => (this.emptyLegs = legs),
        error: (error: HttpErrorResponse) =>
          (this.operationsError = this.messageFromError(error)),
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
    this.setTemporarySuccess('forgotSuccess', '');
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      this.forgotError = 'Ingresa un email válido.';
      return;
    }
    this.isForgotSubmitting = true;
    this.http.post<{ message: string }>(`${this.apiUrl}/owners/password/forgot`, this.forgotForm.getRawValue()).subscribe({
      next: (response) => {
        this.isForgotSubmitting = false;
        this.setTemporarySuccess('forgotSuccess', response.message);
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
    this.setTemporarySuccess('documentsSuccess', '');
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
    this.setTemporarySuccess('documentsSuccess', '');
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
        this.setTemporarySuccess(
          'documentsSuccess',
          'Archivos cargados exitosamente. Quedaron pendientes de revisión.',
        );
        this.refreshOwnerBoatDocuments(documents);
        if (
          this.activeModal === 'register' &&
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
    this.setTemporarySuccess('successMessage', '');
    this.setTemporarySuccess('documentsSuccess', '');
    this.imageError = '';
  }

  private continueToDocuments(boat: BoatResponse, imageUploaded = false): void {
    this.isSubmitting = false;
    this.currentStep = 3;
    this.setTemporarySuccess(
      'successMessage',
      imageUploaded
        ? `La lancha ${boat.name} y su imagen fueron cargadas. Ahora carga la documentación requerida.`
        : `La lancha ${boat.name} fue registrada. Ahora carga la documentación requerida.`,
    );
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
    if (error.status === 401) {
      return 'Tu sesión no es válida o venció. Inicia sesión nuevamente.';
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el backend. Verifica que el servidor esté iniciado e inténtalo nuevamente.';
    }

    const message = error.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || 'No se pudo completar la operación. Verifica la conexión con el backend.';
  }

  private loginMessageFromError(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'El correo o la contraseña no son correctos.';
    }

    return this.messageFromError(error);
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

// Runtime validation coverage for boat approval and owner registration progression.
import { FormBuilder } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { BoatsService } from '../../core/services/boat.service';
import { Home } from './home';

describe('Home approval and owner registration', () => {
  let httpClient: {
    get: jasmine.Spy;
    post: jasmine.Spy;
    patch: jasmine.Spy;
  };
  let boatsService: jasmine.SpyObj<BoatsService>;
  let routeQuery: Record<string, string>;

  beforeEach(async () => {
    localStorage.clear();
    routeQuery = {};
    httpClient = {
      get: jasmine.createSpy('get').and.returnValue(of([])),
      post: jasmine.createSpy('post').and.returnValue(of({})),
      patch: jasmine.createSpy('patch').and.returnValue(of({})),
    };
    boatsService = jasmine.createSpyObj<BoatsService>('BoatsService', [
      'listAvailable',
      'uploadImage',
      'uploadDocuments',
    ]);
    boatsService.listAvailable.and.returnValue(of([]));
    boatsService.uploadDocuments.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        FormBuilder,
        { provide: HttpClient, useValue: httpClient },
        { provide: BoatsService, useValue: boatsService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => routeQuery[key] ?? null,
              },
            },
          },
        },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('loads admin data immediately and dismisses login feedback within five seconds', fakeAsync(() => {
    const pendingBoatsResponse = new Subject<unknown>();
    const adminUsersResponse = new Subject<unknown>();
    const pendingBoats = [
      {
        id: 'boat-id',
        registrationNumber: 'ABC-123',
        name: 'Estrella',
        passengerCapacity: 8,
        availablePassengerCapacity: 8,
        coverageZone: 'Delta',
        imageUrl: null,
        imagePublicId: null,
        verificationStatus: 'pending',
        averageRating: null,
        feedbackCount: 0,
      },
    ];
    httpClient.post.and.returnValue(
      of({
        accessToken: 'admin-token',
        admin: {
          id: 'admin-id',
          fullName: 'Admin Example',
          email: 'admin@example.com',
        },
      }),
    );
    httpClient.get.and.callFake((url: string) =>
      url.endsWith('/admin/boats/pending')
        ? pendingBoatsResponse.asObservable()
        : url.endsWith('/admin/users')
          ? adminUsersResponse.asObservable()
          : of([]),
    );

    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.loginRole = 'admin';
    home.loginForm.setValue({
      email: 'admin@example.com',
      password: 'SecurePassword123',
    });

    home.login();

    expect(httpClient.get).toHaveBeenCalledTimes(6);
    expect(home.authSuccessMessage).toBe('Inicio de sesión exitoso.');
    expect(home.currentUser?.id).toBe('admin-id');
    expect(home.isLoadingAdminUsers).toBeTrue();
    adminUsersResponse.next([
      {
        id: 'owner-id',
        fullName: 'Lanchero Example',
        email: 'owner@example.com',
        phone: '+54 11 1234 5678',
        role: 'owner',
        createdAt: '2026-04-11T12:00:00.000Z',
      },
    ]);
    expect(home.filteredAdminOwners).toHaveSize(1);
    expect(home.authSuccessMessage).toBe('Inicio de sesión exitoso.');
    tick(4999);
    expect(home.authSuccessMessage).toBe('Inicio de sesión exitoso.');
    tick(1);
    expect(home.authSuccessMessage).toBe('');
    pendingBoatsResponse.next(pendingBoats);
    expect(home.pendingBoats).toEqual(pendingBoats);
    fixture.destroy();
  }));

  it('clears login credentials when the selected account type changes', () => {
    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.loginForm.setValue({
      email: 'owner@example.com',
      password: 'SecurePassword123',
    });
    home.loginForm.markAllAsTouched();

    home.selectLoginRole('admin');

    expect(home.loginForm.getRawValue()).toEqual({ email: '', password: '' });
    expect(home.loginForm.pristine).toBeTrue();
    expect(home.loginForm.untouched).toBeTrue();
    fixture.destroy();
  });

  it('shows a frontend-owned login error instead of the backend token message', () => {
    httpClient.post.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { message: 'El token es inválido o venció' },
          }),
      ),
    );
    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.loginForm.setValue({
      email: 'admin@example.com',
      password: 'SecurePassword123',
    });

    home.login();

    expect(home.loginError).toBe('El correo o la contraseña no son correctos.');
    expect(home.loginError).not.toContain('token');
    fixture.destroy();
  });

  it('shows a clear message when the login request cannot reach the backend', () => {
    httpClient.post.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 0,
            error: new TypeError('Failed to fetch'),
          }),
      ),
    );
    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.loginForm.setValue({
      email: 'admin@example.com',
      password: 'SecurePassword123',
    });

    home.login();

    expect(home.loginError).toBe(
      'No se pudo conectar con el backend. Verifica que el servidor esté iniciado e inténtalo nuevamente.',
    );
    fixture.destroy();
  });

  it('filters registered accounts by role and name, email, or phone', () => {
    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.adminUsers = [
      {
        id: 'admin-id',
        fullName: 'Admin Example',
        email: 'admin@example.com',
        phone: null,
        role: 'admin',
        createdAt: '2026-04-11T12:00:00.000Z',
      },
      {
        id: 'owner-id',
        fullName: 'Lanchero Example',
        email: 'owner@example.com',
        phone: '+54 11 1234 5678',
        role: 'owner',
        createdAt: '2026-04-11T12:00:00.000Z',
      },
    ];

    home.adminUserSearch = '1234';

    expect(home.filteredAdminAdmins).toEqual([]);
    expect(home.filteredAdminOwners.map((user) => user.id)).toEqual(['owner-id']);
    fixture.destroy();
  });

  it('sends only one request when approval is clicked repeatedly', () => {
    const approvalResponse = new Subject<unknown>();
    httpClient.patch.and.returnValue(approvalResponse);
    localStorage.setItem('nautiflow_access_token', 'admin-token');

    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.pendingBoats = [
      {
        id: 'boat-id',
        registrationNumber: 'ABC-123',
        name: 'Estrella',
        passengerCapacity: 8,
        availablePassengerCapacity: 8,
        coverageZone: 'Delta',
        imageUrl: null,
        imagePublicId: null,
        verificationStatus: 'pending',
        averageRating: null,
        feedbackCount: 0,
        documents: [
          {
            id: 'document-id',
            type: 'license',
            fileUrl: 'https://example.com/license.pdf',
            originalName: 'license.pdf',
            verificationStatus: 'pending',
          },
        ],
      },
    ];
    home.documentedCapacities['boat-id'] = 8;

    home.verifyBoat('boat-id', 'approved');
    home.verifyBoat('boat-id', 'approved');

    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(home.verifyingBoatId).toBe('boat-id');

    approvalResponse.next({});
    approvalResponse.complete();

    expect(home.pendingBoats).toEqual([]);
    expect(home.accountSuccess).toContain('aprobada');
    fixture.destroy();
  });

  it('advances from boat registration through document upload to completion', () => {
    const ownerResponse = new Subject<unknown>();
    const boatResponse = new Subject<unknown>();
    const documentsResponse = new Subject<{
      id: string;
      type: 'license';
      fileUrl: string;
      originalName: string;
      verificationStatus: string;
    }[]>();
    httpClient.post.and.returnValues(ownerResponse, boatResponse);
    boatsService.uploadDocuments.and.returnValue(documentsResponse);

    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.activeModal = 'register';
    home.ownerForm.setValue({
      fullName: 'Lanchero Example',
      email: 'owner@gmail.com',
      phone: '+54 9 11 1234 5678',
      password: 'SecurePassword123',
    });

    home.registerOwner();
    home.registerOwner();
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith(
      jasmine.stringMatching('/owners/register$'),
      home.ownerForm.getRawValue(),
    );

    ownerResponse.next({
      id: 'owner-id',
      fullName: 'Lanchero Example',
      email: 'owner@gmail.com',
    });
    ownerResponse.complete();
    expect(home.currentStep).toBe(2);

    home.currentStep = 2;
    home.boatForm.setValue({
      registrationNumber: 'ABC-123',
      name: 'Estrella',
      passengerCapacity: 8,
      coverageZone: 'Delta',
    });

    home.registerBoat();
    home.registerBoat();
    expect(httpClient.post).toHaveBeenCalledTimes(2);

    boatResponse.next({
      id: 'boat-id',
      name: 'Estrella',
      registrationNumber: 'ABC-123',
    });
    boatResponse.complete();
    expect(home.currentStep).toBe(3);

    home.selectedDocuments = {
      license: new File(['license'], 'license.pdf', {
        type: 'application/pdf',
      }),
      insurance: new File(['insurance'], 'insurance.pdf', {
        type: 'application/pdf',
      }),
      criminalRecord: new File(['record'], 'record.pdf', {
        type: 'application/pdf',
      }),
    };
    home.uploadDocuments();
    home.uploadDocuments();
    expect(boatsService.uploadDocuments).toHaveBeenCalledTimes(1);

    documentsResponse.next([
      {
        id: 'license-id',
        type: 'license',
        fileUrl: 'https://example.com/license.pdf',
        originalName: 'license.pdf',
        verificationStatus: 'pending',
      },
    ]);
    documentsResponse.complete();
    expect(home.currentStep).toBe(4);
    expect(home.documentsSuccess).toContain('cargados exitosamente');
    expect(home.registeredBoat?.documents?.[0].originalName).toBe('license.pdf');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Archivos cargados exitosamente. Quedaron pendientes de revisión.',
    );
    fixture.destroy();
  });

  it('requests catalogue results with capacity, zone, and availability filters', () => {
    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    expect(boatsService.listAvailable).toHaveBeenCalledWith({});
    home.minPassengerCapacity = 6;
    home.coverageZoneFilter = ' Delta ';
    home.availabilityFilter = 'available';

    home.searchAvailableBoats();

    expect(boatsService.listAvailable).toHaveBeenCalledWith({
      minCapacity: 6,
      zone: 'Delta',
      availability: 'available',
    });
    fixture.destroy();
  });

  it('keeps the public trip list in a loading state until the automatic request finishes', async () => {
    const publicTripsResponse = new Subject<unknown>();
    httpClient.get.and.callFake((url: string) =>
      url.endsWith('/trips') ? publicTripsResponse.asObservable() : of([]),
    );

    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;

    expect(home.isLoadingPublicTrips).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Cargando viajes publicados...',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'Todavía no hay viajes publicados.',
    );
    publicTripsResponse.next([]);
    expect(home.isLoadingPublicTrips).toBeFalse();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Todavía no hay viajes publicados.',
    );
    fixture.destroy();
  });

  it('refreshes the saved availability list immediately after registration', () => {
    localStorage.setItem('nautiflow_access_token', 'admin-token');
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const availableBoat = {
      id: 'boat-id',
      name: 'Estrella',
      registrationNumber: 'ABC-123',
      passengerCapacity: 8,
      availablePassengerCapacity: 8,
      coverageZone: 'Delta',
      owner: { fullName: 'Lanchero', phone: null },
      availabilityWindows: [{
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      }],
    };
    httpClient.get.and.callFake((url: string) =>
      url.endsWith('/admin/boats/active') ? of([availableBoat]) : of([]),
    );
    httpClient.post.and.returnValue(of({}));

    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.availabilityBoatId = 'boat-id';
    home.availabilityStartsAt = new Date(
      startsAt.getTime() - startsAt.getTimezoneOffset() * 60_000,
    )
      .toISOString()
      .slice(0, 16);
    home.availabilityEndsAt = new Date(
      endsAt.getTime() - endsAt.getTimezoneOffset() * 60_000,
    )
      .toISOString()
      .slice(0, 16);

    home.saveAvailabilityWindow();

    expect(httpClient.get).toHaveBeenCalledWith(
      jasmine.stringMatching('/admin/boats/active$'),
      jasmine.any(Object),
    );
    expect(home.tripBoatsWithAvailability.map((boat) => boat.id)).toEqual([
      'boat-id',
    ]);
    fixture.destroy();
  });

  it('renders a WhatsApp availability link for a public boat', () => {
    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.filteredAvailableBoats = [
      {
        id: 'boat-id',
        registrationNumber: 'ABC-123',
        name: 'Estrella',
        passengerCapacity: 8,
        availablePassengerCapacity: 5,
        coverageZone: 'Delta',
        imageUrl: null,
        imagePublicId: null,
        verificationStatus: 'approved',
        owner: {
          fullName: 'Lanchero',
          whatsappUrl:
            'https://wa.me/5491123456789?text=Hola%2C%20quiero%20consultar',
        },
        averageRating: null,
        feedbackCount: 0,
      },
    ];

    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      'a[aria-label="Consultar disponibilidad de Estrella por WhatsApp"]',
    ) as HTMLAnchorElement | null;
    expect(link?.getAttribute('href')).toBe(
      'https://wa.me/5491123456789?text=Hola%2C%20quiero%20consultar',
    );
    expect(link?.querySelector('svg')).not.toBeNull();
    fixture.destroy();
  });

  it('searches the admin fleet using free seats, zone, and a future time', () => {
    localStorage.setItem('nautiflow_access_token', 'admin-token');
    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    const requestedTime = new Date(Date.now() + 60 * 60 * 1000);
    requestedTime.setSeconds(0, 0);
    home.fleetSearchPassengers = 5;
    home.fleetSearchZone = 'Primera Sección';
    home.fleetAvailableAt = new Date(
      requestedTime.getTime() - requestedTime.getTimezoneOffset() * 60_000,
    )
      .toISOString()
      .slice(0, 16);

    home.searchAdminFleet();

    const [url, options] = httpClient.get.calls.mostRecent().args as [
      string,
      { params: { get: (name: string) => string | null } },
    ];
    expect(url).toContain('/admin/fleet/search');
    expect(options.params.get('minPassengers')).toBe('5');
    expect(options.params.get('availableAt')).toBe(
      requestedTime.toISOString(),
    );
    expect(options.params.get('zone')).toBe('Primera Sección');
    expect(home.hasSearchedFleet).toBeTrue();
    fixture.destroy();
  });

  it('creates a trip for an approved boat from the admin panel', () => {
    const trip = { id: 'trip-id', boat: { id: 'boat-id', name: 'Estrella' } };
    const formatDateTimeLocal = (date: Date): string => {
      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
      return localDate.toISOString().slice(0, 16);
    };
    httpClient.post.and.returnValue(of(trip));
    localStorage.setItem('nautiflow_access_token', 'admin-token');

    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.userRole = 'admin';
    home.activeFleet = [{
      id: 'boat-id',
      name: 'Estrella',
      registrationNumber: 'ABC-123',
      passengerCapacity: 8,
      availablePassengerCapacity: 8,
      coverageZone: 'Delta',
      owner: { fullName: 'Lanchero', phone: null },
      availabilityWindows: [{
        startsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      }],
    }];
    home.openTripModal();
    home.tripBoatId = 'boat-id';
    home.tripOrigin = ' Tigre ';
    home.tripDestination = ' Delta ';
    home.tripStartsAt = formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000));
    home.tripEndsAt = formatDateTimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1000));

    home.createTrip();

    expect(httpClient.post).toHaveBeenCalledWith(
      jasmine.stringMatching('/admin/trips$'),
      jasmine.objectContaining({
        boatId: 'boat-id',
        origin: 'Tigre',
        destination: 'Delta',
      }),
      jasmine.any(Object),
    );
    expect(home.showTripModal).toBeFalse();
    expect(home.tripSuccess).toContain('Estrella');
    fixture.destroy();
  });

  it('does not publish a trip without a saved availability window', () => {
    localStorage.setItem('nautiflow_access_token', 'admin-token');
    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.userRole = 'admin';
    home.activeFleet = [{
      id: 'boat-id',
      name: 'Estrella',
      registrationNumber: 'ABC-123',
      passengerCapacity: 8,
      availablePassengerCapacity: 8,
      coverageZone: 'Delta',
      owner: { fullName: 'Lanchero', phone: null },
      availabilityWindows: [],
    }];
    home.tripBoatId = 'boat-id';
    home.tripOrigin = 'Tigre';
    home.tripDestination = 'Delta';
    home.tripStartsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    home.tripEndsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    home.createTrip();

    expect(httpClient.post).not.toHaveBeenCalled();
    expect(home.tripError).toContain('Guarda primero una disponibilidad');
    fixture.destroy();
  });

  it('publishes an empty leg and prepares the WhatsApp message', () => {
    localStorage.setItem('nautiflow_access_token', 'admin-token');
    const returnsAt = new Date(Date.now() + 60 * 60 * 1000);
    returnsAt.setSeconds(0, 0);
    const localReturnsAt = new Date(
      returnsAt.getTime() - returnsAt.getTimezoneOffset() * 60_000,
    )
      .toISOString()
      .slice(0, 16);
    httpClient.post.and.returnValue(
      of({
        id: 'leg-id',
        origin: 'Primera Sección',
        destination: 'Tigre',
        returnsAt: returnsAt.toISOString(),
        boat: {
          id: 'boat-id',
          name: 'Estrella',
          owner: { fullName: 'Lanchero', phone: null },
        },
      }),
    );
    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;
    home.activeFleet = [{
      id: 'boat-id',
      name: 'Estrella',
      registrationNumber: 'ABC-123',
      passengerCapacity: 8,
      availablePassengerCapacity: 8,
      coverageZone: 'Delta',
      owner: { fullName: 'Lanchero', phone: null },
      availabilityWindows: [{
        startsAt: new Date(returnsAt.getTime() - 30 * 60 * 1000).toISOString(),
        endsAt: new Date(returnsAt.getTime() + 30 * 60 * 1000).toISOString(),
      }],
    }];
    home.emptyLegBoatId = 'boat-id';
    home.emptyLegOrigin = 'Primera Sección';
    home.emptyLegDestination = 'Tigre';
    home.emptyLegReturnsAt = localReturnsAt;

    home.publishEmptyLeg();

    expect(httpClient.post).toHaveBeenCalledWith(
      jasmine.stringMatching('/admin/empty-legs'),
      jasmine.objectContaining({
        boatId: 'boat-id',
        origin: 'Primera Sección',
        destination: 'Tigre',
        returnsAt: returnsAt.toISOString(),
      }),
      jasmine.any(Object),
    );
    expect(home.emptyLegAnnouncement).toContain('Lancha Estrella vuelve vacía');
    expect(home.emptyLegAnnouncement).toContain('¿Alguien necesita un rescate');
    expect(home.operationsSuccess).toContain('Retorno vacío publicado');
    fixture.destroy();
  });

  it('submits a public review using the trip link token', () => {
    const token = 'a'.repeat(43);
    routeQuery['review'] = token;
    httpClient.get.and.callFake((url: string) =>
      url.endsWith('/reviews/' + token)
        ? of({
            trip: {
              id: 'trip-id',
              origin: 'Tigre',
              destination: 'Delta',
              completedAt: '2026-04-11T12:00:00.000Z',
              boat: { name: 'Estrella' },
            },
            alreadyReviewed: false,
          })
        : of([]),
    );
    httpClient.post.and.returnValue(of({ id: 'feedback-id' }));

    const fixture = TestBed.createComponent(Home);
    const home = fixture.componentInstance;

    expect(home.reviewDetails?.trip.boat.name).toBe('Estrella');
    home.reviewRating = 5;
    home.reviewComment = 'Excelente viaje';
    home.submitReview();

    expect(httpClient.post).toHaveBeenCalledWith(
      jasmine.stringMatching('/reviews/' + token + '$'),
      { rating: 5, comment: 'Excelente viaje' },
    );
    expect(home.reviewDetails?.alreadyReviewed).toBeTrue();
    expect(home.reviewSuccess).toContain('Gracias');
    fixture.destroy();
  });
});

// Runtime validation coverage for boat approval and owner registration progression.
import { FormBuilder } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { BoatsService } from '../../core/services/boat.service';
import { Home } from './home';

describe('Home approval and owner registration', () => {
  let httpClient: {
    get: jasmine.Spy;
    post: jasmine.Spy;
    patch: jasmine.Spy;
  };
  let boatsService: jasmine.SpyObj<BoatsService>;

  beforeEach(async () => {
    localStorage.clear();
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
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

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
});

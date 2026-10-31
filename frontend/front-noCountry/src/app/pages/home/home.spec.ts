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
});

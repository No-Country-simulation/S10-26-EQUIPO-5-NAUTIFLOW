import { isPlatformBrowser } from '@angular/common';
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Boat {
  id: string;
  registrationNumber: string;
  name: string;
  passengerCapacity: number;
  availablePassengerCapacity: number;
  coverageZone: string;
  imageUrl: string | null;
  imagePublicId: string | null;
  verificationStatus: string;
  owner?: { fullName: string };
  averageRating: number | null;
  feedbackCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class BoatsService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiUrl = this.createApiUrl();

  private createApiUrl(): string {
    const backendUrl = isPlatformBrowser(this.platformId)
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'http://backend:3001';
    return `${backendUrl}/api/boats`;
  }

  uploadImage(boatId: string, file: File): Observable<Boat> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<Boat>(`${this.apiUrl}/${boatId}/image`, formData);
  }

  uploadDocuments(boatId: string, documents: FormData): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${boatId}/documents`, documents);
  }

  listMine(token: string): Observable<Boat[]> {
    return this.http.get<Boat[]>(`${this.apiUrl}/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  listAvailable(): Observable<Boat[]> {
    return this.http.get<Boat[]>(this.apiUrl);
  }
}

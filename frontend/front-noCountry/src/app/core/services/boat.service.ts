import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Boat {
  id: string;
  registrationNumber: string;
  name: string;
  passengerCapacity: number;
  coverageZone: string;
  imageUrl: string | null;
  imagePublicId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class BoatsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3001/api/boats';

  uploadImage(boatId: string, file: File): Observable<Boat> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<Boat>(`${this.apiUrl}/${boatId}/image`, formData);
  }
}
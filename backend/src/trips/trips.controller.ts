import { Controller, Get, Header } from '@nestjs/common';
import { TripsService } from './trips.service.js';

@Controller('api/trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  listPublic() {
    return this.tripsService.listPublic();
  }
}

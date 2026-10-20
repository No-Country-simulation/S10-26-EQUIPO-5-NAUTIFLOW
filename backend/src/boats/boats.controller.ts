import { Body, Controller, Post } from '@nestjs/common';
import { CreateBoatDto } from './dto/create-boat.dto.js';
import { BoatsService } from './boats.service.js';

@Controller('api/boats')
export class BoatsController {
  constructor(private readonly boatsService: BoatsService) {}

  @Post()
  create(@Body() dto: CreateBoatDto) {
    return this.boatsService.create(dto);
  }
}

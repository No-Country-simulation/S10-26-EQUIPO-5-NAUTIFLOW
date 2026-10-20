import { Body, Controller, Post } from '@nestjs/common';
import { RegisterOwnerDto } from './dto/register-owner.dto.js';
import { OwnersService } from './owners.service.js';

@Controller('api/owners')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post('register')
  register(@Body() dto: RegisterOwnerDto) {
    return this.ownersService.register(dto);
  }
}

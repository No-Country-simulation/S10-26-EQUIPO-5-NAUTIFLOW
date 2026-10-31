import { Body, Controller, Post } from '@nestjs/common';
import { AdminLoginDto } from './dto/admin-login.dto.js';
import { AuthService } from './auth.service.js';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.authService.loginAdmin(dto.email, dto.password);
  }

  @Post('owner-login')
  loginOwner(@Body() dto: AdminLoginDto) {
    return this.authService.loginOwner(dto.email, dto.password);
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Owner } from './owner.entity.js';
import { OwnersController } from './owners.controller.js';
import { PasswordResetToken } from './password-reset-token.entity.js';
import { PasswordResetMailer } from './password-reset.mailer.js';
import { OwnersService } from './owners.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Owner, PasswordResetToken])],
  controllers: [OwnersController],
  providers: [OwnersService, PasswordResetMailer],
  exports: [OwnersService, TypeOrmModule],
})
export class OwnersModule {}

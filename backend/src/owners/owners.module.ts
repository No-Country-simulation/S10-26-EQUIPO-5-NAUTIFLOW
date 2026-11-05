import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Owner } from './owner.entity.js';
import { OwnerNotification } from './owner-notification.entity.js';
import { OwnerNotificationsService } from './owner-notifications.service.js';
import { OwnersController } from './owners.controller.js';
import { PasswordResetToken } from './password-reset-token.entity.js';
import { PasswordResetMailer } from './password-reset.mailer.js';
import { OwnersService } from './owners.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Owner, PasswordResetToken, OwnerNotification]),
  ],
  controllers: [OwnersController],
  providers: [OwnersService, OwnerNotificationsService, PasswordResetMailer],
  exports: [OwnersService, TypeOrmModule],
})
export class OwnersModule {}

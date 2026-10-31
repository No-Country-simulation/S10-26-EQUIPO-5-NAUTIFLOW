import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Owner } from '../owners/owner.entity.js';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JWT_ALGORITHM, JWT_ISSUER } from './jwt.constants.js';
import { OwnerAuthGuard } from './owner-auth.guard.js';
import { PassengerAuthGuard } from './passenger-auth.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Owner]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (Buffer.byteLength(secret, 'utf8') < 32) {
          throw new Error('JWT_SECRET debe tener al menos 32 bytes.');
        }

        return {
          secret,
          signOptions: {
            algorithm: JWT_ALGORITHM,
            issuer: JWT_ISSUER,
          },
          verifyOptions: {
            algorithms: [JWT_ALGORITHM],
            issuer: JWT_ISSUER,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AdminAuthGuard, OwnerAuthGuard, PassengerAuthGuard],
  exports: [AdminAuthGuard, OwnerAuthGuard, PassengerAuthGuard, JwtModule],
})
export class AuthModule {}

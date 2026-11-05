import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { Owner } from '../owners/owner.entity.js';
import {
  JWT_ALGORITHM,
  JWT_EXPIRES_IN_SECONDS,
  JWT_ISSUER,
} from './jwt.constants.js';

interface AdminTokenPayload {
  sub: string;
  role: string;
}

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
    private readonly jwtService: JwtService,
  ) {}

  async loginAdmin(emailAddress: string, password: string) {
    return this.loginWithRole(emailAddress, password, 'admin');
  }

  async loginOwner(emailAddress: string, password: string) {
    return this.loginWithRole(emailAddress, password, 'owner');
  }

  private async loginWithRole(
    emailAddress: string,
    password: string,
    role: 'admin' | 'owner',
  ) {
    const email = emailAddress.trim().toLowerCase();
    const account = await this.ownersRepository
      .createQueryBuilder('owner')
      .addSelect('owner.passwordHash')
      .where('owner.email = :email', { email })
      .getOne();

    if (
      !account ||
      account.role !== role ||
      !account.passwordHash ||
      !(await this.passwordMatches(password, account.passwordHash))
    ) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.login.failed',
          role,
          email: this.maskEmail(email),
        }),
      );
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const payload: AdminTokenPayload = { sub: account.id, role: account.role };
    const accessToken = await this.jwtService.signAsync(payload, {
      algorithm: JWT_ALGORITHM,
      expiresIn: JWT_EXPIRES_IN_SECONDS,
      issuer: JWT_ISSUER,
    });
    this.logger.log(
      JSON.stringify({
        event: 'auth.login.succeeded',
        role,
        email: this.maskEmail(email),
      }),
    );

    const user = {
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      role: account.role,
    };

    return role === 'admin'
      ? {
          accessToken,
          tokenType: 'Bearer',
          expiresIn: JWT_EXPIRES_IN_SECONDS,
          admin: user,
        }
      : {
          accessToken,
          tokenType: 'Bearer',
          expiresIn: JWT_EXPIRES_IN_SECONDS,
          user,
        };
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '[invalid-email]';

    return `${localPart[0]}***@${domain[0]}***`;
  }

  private async passwordMatches(
    password: string,
    encodedHash: string,
  ): Promise<boolean> {
    const [salt, storedKey, ...extraParts] = encodedHash.split(':');
    if (
      !salt ||
      !storedKey ||
      extraParts.length > 0 ||
      !/^[a-f\d]{128}$/i.test(storedKey)
    ) {
      return false;
    }

    const expected = Buffer.from(storedKey, 'hex');
    const actual = await deriveKey(password, salt);
    return timingSafeEqual(actual, expected);
  }
}

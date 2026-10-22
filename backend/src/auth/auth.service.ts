import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { Owner } from '../owners/owner.entity.js';

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
  constructor(
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
    private readonly jwtService: JwtService,
  ) {}

  async loginAdmin(emailAddress: string, password: string) {
    const email = emailAddress.trim().toLowerCase();
    const admin = await this.ownersRepository
      .createQueryBuilder('owner')
      .addSelect('owner.passwordHash')
      .where('owner.email = :email', { email })
      .getOne();

    if (
      !admin ||
      admin.role !== 'admin' ||
      !admin.passwordHash ||
      !(await this.passwordMatches(password, admin.passwordHash))
    ) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const payload: AdminTokenPayload = { sub: admin.id, role: admin.role };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '1h',
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      admin: {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
      },
    };
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

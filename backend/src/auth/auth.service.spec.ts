import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { scryptSync } from 'node:crypto';
import { Owner } from '../owners/owner.entity.js';
import { AuthService } from './auth.service.js';
import {
  JWT_ALGORITHM,
  JWT_EXPIRES_IN_SECONDS,
  JWT_ISSUER,
} from './jwt.constants.js';

describe('AuthService', () => {
  const getOne = vi.fn();
  const where = vi.fn(() => ({ getOne }));
  const addSelect = vi.fn(() => ({ where }));
  const createQueryBuilder = vi.fn(() => ({ addSelect }));
  const ownersRepository = { createQueryBuilder };
  const jwtService = { signAsync: vi.fn().mockResolvedValue('jwt-token') };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      ownersRepository as unknown as Repository<Owner>,
      jwtService as unknown as JwtService,
    );
  });

  it('issues a token only for valid admin credentials', async () => {
    const salt = 'admin-test-salt';
    const password = 'a-secure-admin-password';
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
    getOne.mockResolvedValue({
      id: 'admin-id',
      fullName: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      passwordHash,
    });

    const result = await service.loginAdmin(' ADMIN@example.com ', password);

    expect(where).toHaveBeenCalledWith('owner.email = :email', {
      email: 'admin@example.com',
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'admin-id', role: 'admin' },
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: JWT_EXPIRES_IN_SECONDS,
        issuer: JWT_ISSUER,
      },
    );
    expect(result).toMatchObject({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      admin: { id: 'admin-id', email: 'admin@example.com' },
    });
    expect(result.admin).not.toHaveProperty('passwordHash');
  });

  it('rejects owner accounts even when the password is correct', async () => {
    const salt = 'owner-test-salt';
    const password = 'a-secure-owner-password';
    getOne.mockResolvedValue({
      id: 'owner-id',
      role: 'owner',
      passwordHash: `${salt}:${scryptSync(password, salt, 64).toString('hex')}`,
    });

    await expect(
      service.loginAdmin('owner@example.com', password),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('issues a token for valid owner credentials through owner login', async () => {
    const salt = 'owner-test-salt';
    const password = 'a-secure-owner-password';
    getOne.mockResolvedValue({
      id: 'owner-id',
      fullName: 'Boat Owner',
      email: 'owner@example.com',
      role: 'owner',
      passwordHash: `${salt}:${scryptSync(password, salt, 64).toString('hex')}`,
    });

    const result = await service.loginOwner(' OWNER@example.com ', password);

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'owner-id', role: 'owner' },
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: JWT_EXPIRES_IN_SECONDS,
        issuer: JWT_ISSUER,
      },
    );
    expect(result).toMatchObject({
      accessToken: 'jwt-token',
      user: { id: 'owner-id', fullName: 'Boat Owner', role: 'owner' },
    });
  });

  it('issues a token for valid passenger credentials through passenger login', async () => {
    const salt = 'passenger-test-salt';
    const password = 'a-secure-passenger-password';
    getOne.mockResolvedValue({
      id: 'passenger-id',
      fullName: 'River Passenger',
      email: 'passenger@example.com',
      role: 'passenger',
      passwordHash: `${salt}:${scryptSync(password, salt, 64).toString('hex')}`,
    });

    const result = await service.loginPassenger(
      ' PASSENGER@example.com ',
      password,
    );

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'passenger-id', role: 'passenger' },
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: JWT_EXPIRES_IN_SECONDS,
        issuer: JWT_ISSUER,
      },
    );
    expect(result).toMatchObject({
      accessToken: 'jwt-token',
      user: {
        id: 'passenger-id',
        fullName: 'River Passenger',
        role: 'passenger',
      },
    });
  });

  it('rejects incorrect passwords', async () => {
    const salt = 'admin-test-salt';
    getOne.mockResolvedValue({
      id: 'admin-id',
      role: 'admin',
      passwordHash: `${salt}:${scryptSync('another-password', salt, 64).toString('hex')}`,
    });

    await expect(
      service.loginAdmin('admin@example.com', 'a-wrong-password'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

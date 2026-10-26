import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { scryptSync } from 'node:crypto';
import { Owner } from '../owners/owner.entity.js';
import { AuthService } from './auth.service.js';

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
      { expiresIn: '1h' },
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

import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { Owner } from './owner.entity.js';
import { PasswordResetToken } from './password-reset-token.entity.js';
import { PasswordResetMailer } from './password-reset.mailer.js';
import { OwnersService } from './owners.service.js';

describe('OwnersService password recovery', () => {
  const ownersRepository = {
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve({ id: 'owner-id', ...value })),
  };
  const resetTokensRepository = {
    create: vi.fn((value) => value),
    delete: vi.fn(),
    save: vi.fn((value) => Promise.resolve(value)),
  };
  const resetMailer = { assertConfigured: vi.fn(), sendResetLink: vi.fn() };
  const dataSource = { transaction: vi.fn() };

  let service: OwnersService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMailer.assertConfigured.mockReset();
    resetMailer.sendResetLink.mockReset();
    service = new OwnersService(
      ownersRepository as unknown as Repository<Owner>,
      resetTokensRepository as unknown as Repository<PasswordResetToken>,
      dataSource as unknown as DataSource,
      resetMailer as unknown as PasswordResetMailer,
    );
  });

  it('returns the same generic response for an unknown email without sending mail', async () => {
    ownersRepository.findOne.mockResolvedValue(null);

    const result = await service.requestPasswordReset('nobody@example.com');

    expect(result.message).toContain('Si el correo está registrado');
    expect(resetMailer.sendResetLink).not.toHaveBeenCalled();
  });

  it('fails before looking up an account when email delivery is not configured', async () => {
    resetMailer.assertConfigured.mockImplementation(() => {
      throw new Error('El servicio de correo no está configurado');
    });

    await expect(
      service.requestPasswordReset('owner@example.com'),
    ).rejects.toThrow('El servicio de correo no está configurado');

    expect(ownersRepository.findOne).not.toHaveBeenCalled();
  });

  it('stores only a token hash and emails the one-time token', async () => {
    ownersRepository.findOne.mockResolvedValue({
      id: 'owner-id',
      email: 'owner@example.com',
    });

    await service.requestPasswordReset(' OWNER@example.com ');

    expect(ownersRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'owner@example.com', role: 'owner' },
    });
    const persistedToken = resetTokensRepository.create.mock.calls[0][0];
    const emailedToken = resetMailer.sendResetLink.mock.calls[0][1];
    expect(persistedToken.tokenHash).not.toBe(emailedToken);
    expect(persistedToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(persistedToken.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 30 * 60 * 1000,
    );
  });

  it('rejects expired or already-consumed reset tokens', async () => {
    const manager = {
      findOne: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      delete: vi.fn(),
    };
    dataSource.transaction.mockImplementation(async (work) =>
      work(manager as never),
    );

    await expect(
      service.resetPassword('expired-or-used-token', 'new-secure-password'),
    ).rejects.toThrow(NotFoundException);

    const [, options] = manager.findOne.mock.calls[0];
    expect(options.where.expiresAt).toBeDefined();
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('consumes a reset token after changing the password', async () => {
    const manager = {
      findOne: vi.fn().mockResolvedValue({
        id: 'reset-token-id',
        ownerId: 'owner-id',
      }),
      update: vi.fn(),
      delete: vi.fn(),
    };
    dataSource.transaction.mockImplementation(async (work) =>
      work(manager as never),
    );

    await service.resetPassword('one-time-token', 'new-secure-password');

    expect(manager.update).toHaveBeenCalledWith(
      Owner,
      { id: 'owner-id' },
      { passwordHash: expect.stringContaining(':') },
    );
    expect(manager.delete).toHaveBeenCalledWith(PasswordResetToken, {
      id: 'reset-token-id',
    });
  });

  it('does not include the password hash in the registration response', async () => {
    ownersRepository.findOne.mockResolvedValue(null);

    const result = await service.register({
      fullName: 'Boat Owner',
      email: 'owner@example.com',
      phone: '123456789',
      password: 'a-long-password-123',
    });

    expect(result).not.toHaveProperty('passwordHash');
    expect(ownersRepository.findOne).not.toHaveBeenCalled();
    expect(ownersRepository.save.mock.calls[0][0].passwordHash).toContain(':');
  });
});
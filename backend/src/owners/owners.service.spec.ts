import { DataSource, Repository } from 'typeorm';
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
  const resetMailer = { sendResetLink: vi.fn() };
  const dataSource = { transaction: vi.fn() };

  let service: OwnersService;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('stores only a token hash and emails the one-time token', async () => {
    ownersRepository.findOne.mockResolvedValue({
      id: 'owner-id',
      email: 'owner@example.com',
    });

    await service.requestPasswordReset(' OWNER@example.com ');

    const persistedToken = resetTokensRepository.create.mock.calls[0][0];
    const emailedToken = resetMailer.sendResetLink.mock.calls[0][1];
    expect(persistedToken.tokenHash).not.toBe(emailedToken);
    expect(persistedToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(persistedToken.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 30 * 60 * 1000,
    );
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
    expect(ownersRepository.save.mock.calls[0][0].passwordHash).toContain(':');
  });
});
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { JWT_ALGORITHM, JWT_ISSUER } from './jwt.constants.js';

describe('AdminAuthGuard', () => {
  const verifyAsync = vi.fn();
  const jwtService = { verifyAsync };
  const guard = new AdminAuthGuard(jwtService as unknown as JwtService);

  function contextFor(authorization?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a Bearer token', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('forbids valid tokens without the admin role', async () => {
    verifyAsync.mockResolvedValue({ sub: 'owner-id', role: 'owner' });

    await expect(
      guard.canActivate(contextFor('Bearer valid-token')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a valid admin token', async () => {
    verifyAsync.mockResolvedValue({ sub: 'admin-id', role: 'admin' });

    await expect(
      guard.canActivate(contextFor('Bearer valid-token')),
    ).resolves.toBe(true);
    expect(verifyAsync).toHaveBeenCalledWith('valid-token', {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
    });
  });

  it('rejects signed tokens without the required identity claims', async () => {
    verifyAsync.mockResolvedValue({ role: 'admin' });

    await expect(
      guard.canActivate(contextFor('Bearer valid-token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects expired or invalid tokens', async () => {
    verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(
      guard.canActivate(contextFor('Bearer expired-token')),
    ).rejects.toThrow(UnauthorizedException);
  });
});

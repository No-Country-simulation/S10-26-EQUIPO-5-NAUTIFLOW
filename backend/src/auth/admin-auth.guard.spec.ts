import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminAuthGuard } from './admin-auth.guard.js';

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
    expect(verifyAsync).toHaveBeenCalledWith('valid-token');
  });
});

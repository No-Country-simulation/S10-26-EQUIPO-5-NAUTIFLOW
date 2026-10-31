import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { JWT_ALGORITHM, JWT_ISSUER } from './jwt.constants.js';

interface AdminTokenPayload {
  sub: string;
  role: string;
}

interface AuthenticatedRequest extends Request {
  user?: AdminTokenPayload;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const parts = authorization?.split(' ') ?? [];

    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw new UnauthorizedException('Se requiere un token Bearer');
    }

    try {
      const payload = await this.jwtService.verifyAsync<
        Record<string, unknown>
      >(parts[1], {
        algorithms: [JWT_ALGORITHM],
        issuer: JWT_ISSUER,
      });
      if (
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        typeof payload.role !== 'string'
      ) {
        throw new UnauthorizedException('El token no identifica al usuario');
      }
      request.user = { sub: payload.sub, role: payload.role };
    } catch {
      throw new UnauthorizedException('El token es inválido o venció');
    }
    if (request.user.role !== 'admin') {
      throw new ForbiddenException('Se requiere el rol de administrador');
    }

    return true;
  }
}

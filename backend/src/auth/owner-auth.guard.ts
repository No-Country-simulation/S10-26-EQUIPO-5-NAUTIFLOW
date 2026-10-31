import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

interface OwnerTokenPayload {
  sub: string;
  role: string;
}

interface AuthenticatedRequest extends Request {
  user?: OwnerTokenPayload;
}

@Injectable()
export class OwnerAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token, ...extraParts] =
      request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token || extraParts.length > 0) {
      throw new UnauthorizedException('Se requiere un token Bearer');
    }

    try {
      request.user = await this.jwtService.verifyAsync<OwnerTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('El token es inválido o venció');
    }

    if (!request.user.sub) {
      throw new UnauthorizedException('El token no identifica al usuario');
    }
    if (request.user.role !== 'owner') {
      throw new ForbiddenException('Se requiere una cuenta de lanchero');
    }

    return true;
  }
}
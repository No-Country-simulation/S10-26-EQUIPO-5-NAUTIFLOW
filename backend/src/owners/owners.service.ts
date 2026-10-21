import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { RegisterOwnerDto } from './dto/register-owner.dto.js';
import { Owner } from './owner.entity.js';
import { PasswordResetToken } from './password-reset-token.entity.js';
import { PasswordResetMailer } from './password-reset.mailer.js';

const scryptAsync = promisify(scrypt);
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RESET_RESPONSE = {
  message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
};

@Injectable()
export class OwnersService {
  private readonly logger = new Logger(OwnersService.name);

  constructor(
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokensRepository: Repository<PasswordResetToken>,
    private readonly dataSource: DataSource,
    private readonly resetMailer: PasswordResetMailer,
  ) {}

  async register(
    dto: RegisterOwnerDto,
  ): Promise<Pick<Owner, 'id' | 'fullName' | 'email' | 'phone' | 'role' | 'createdAt'>> {
    const email = dto.email.trim().toLowerCase();
    const existingOwner = await this.ownersRepository.findOne({ where: { email } });

    if (existingOwner) {
      throw new ConflictException('Ya existe un lanchero registrado con ese email');
    }

    const owner = this.ownersRepository.create({
      fullName: dto.fullName.trim(),
      email,
      phone: dto.phone.trim(),
      passwordHash: await this.hashPassword(dto.password),
    });

    const savedOwner = await this.ownersRepository.save(owner);
    return {
      id: savedOwner.id,
      fullName: savedOwner.fullName,
      email: savedOwner.email,
      phone: savedOwner.phone,
      role: savedOwner.role,
      createdAt: savedOwner.createdAt,
    };
  }

  async requestPasswordReset(emailAddress: string) {
    const email = emailAddress.trim().toLowerCase();
    const owner = await this.ownersRepository.findOne({ where: { email } });

    if (!owner) {
      return RESET_RESPONSE;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.resetTokensRepository.delete({ ownerId: owner.id });
    await this.resetTokensRepository.save(
      this.resetTokensRepository.create({
        ownerId: owner.id,
        tokenHash,
        expiresAt,
      }),
    );

    try {
      await this.resetMailer.sendResetLink(owner.email, token);
    } catch (error) {
      this.logger.error('No se pudo enviar un enlace de recuperación', error);
    }

    return RESET_RESPONSE;
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await this.dataSource.transaction(async (manager) => {
      const resetToken = await manager.findOne(PasswordResetToken, {
        where: { tokenHash, expiresAt: MoreThan(new Date()) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!resetToken) {
        throw new NotFoundException('El enlace no es válido o ya venció');
      }

      await manager.update(
        Owner,
        { id: resetToken.ownerId },
        { passwordHash: await this.hashPassword(newPassword) },
      );
      await manager.delete(PasswordResetToken, { id: resetToken.id });
    });

    return { message: 'La contraseña se actualizó correctamente.' };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }
}

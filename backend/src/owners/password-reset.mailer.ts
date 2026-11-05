import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordResetMailer {
  constructor(private readonly config: ConfigService) {}

  assertConfigured(): void {
    this.getConfiguration();
  }

  async sendResetLink(email: string, token: string): Promise<void> {
    const { apiKey, from, frontendUrl } = this.getConfiguration();

    const resetUrl = new URL('/reset-password', frontendUrl);
    resetUrl.searchParams.set('token', token);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Restablecer contraseña de Nautiflow',
        text: `Para cambiar tu contraseña, abre este enlace dentro de los próximos 30 minutos: ${resetUrl.toString()}\n\nSi no solicitaste este cambio, ignora este correo.`,
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('No se pudo enviar el correo');
    }
  }

  private getConfiguration(): {
    apiKey: string;
    from: string;
    frontendUrl: string;
  } {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('MAIL_FROM');
    const frontendUrl = this.config.get<string>('FRONTEND_URL');

    if (!apiKey || !from || !frontendUrl) {
      throw new ServiceUnavailableException(
        'El servicio de correo no está configurado',
      );
    }

    return { apiKey, from, frontendUrl };
  }
}

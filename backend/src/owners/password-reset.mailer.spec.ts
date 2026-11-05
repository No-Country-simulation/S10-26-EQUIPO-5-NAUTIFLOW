import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordResetMailer } from './password-reset.mailer.js';

describe('PasswordResetMailer', () => {
  const config = {
    get: vi.fn((key: string) => {
      const values: Record<string, string> = {
        RESEND_API_KEY: 'test-resend-key',
        MAIL_FROM: 'Nautiflow <no-reply@example.com>',
        FRONTEND_URL: 'https://nautiflow.example',
      };
      return values[key];
    }),
  };
  const mailer = new PasswordResetMailer(config as unknown as ConfigService);

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends a reset link through Resend without exposing the API key in the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await mailer.sendResetLink('owner@gmail.com', 'one-time-token');

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers.Authorization).toBe('Bearer test-resend-key');
    expect(body.to).toEqual(['owner@gmail.com']);
    expect(body.text).toContain(
      'https://nautiflow.example/reset-password?token=one-time-token',
    );
    expect(options.body).not.toContain('test-resend-key');
  });

  it('reports Resend delivery failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(
      mailer.sendResetLink('owner@gmail.com', 'one-time-token'),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { HttpRequestLoggingMiddleware } from './http-request-logging.middleware.js';

describe('HttpRequestLoggingMiddleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs request start and completion with an ID and duration', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const request = {
      method: 'GET',
      path: '/api/boats',
    } as Request;
    const response = Object.assign(new EventEmitter(), {
      setHeader: vi.fn(),
      statusCode: 200,
      writableEnded: false,
    }) as unknown as Response;
    const next = vi.fn();

    new HttpRequestLoggingMiddleware().use(request, response, next);

    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      expect.any(String),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"event":"http.request.started"'),
    );
    expect(next).toHaveBeenCalledOnce();

    response.emit('finish');

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"event":"http.request.completed"'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"durationMs":'),
    );
  });

  it('logs client errors as warnings and does not include query values', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const request = {
      method: 'POST',
      path: '/api/auth/login',
      originalUrl: '/api/auth/login?token=private',
    } as Request;
    const response = Object.assign(new EventEmitter(), {
      setHeader: vi.fn(),
      statusCode: 401,
      writableEnded: false,
    }) as unknown as Response;

    new HttpRequestLoggingMiddleware().use(request, response, vi.fn());
    response.emit('finish');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"event":"http.request.failed"'),
    );
    const messages = [...log.mock.calls, ...warn.mock.calls]
      .flat()
      .join(' ');
    expect(messages).not.toContain('private');
  });
});

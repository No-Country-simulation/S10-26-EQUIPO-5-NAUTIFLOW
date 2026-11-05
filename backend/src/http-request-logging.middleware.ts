import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class HttpRequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpRequestLoggingMiddleware.name);

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const startedAt = performance.now();
    let completionLogged = false;

    response.setHeader('X-Request-Id', requestId);
    this.logger.log(
      JSON.stringify({
        event: 'http.request.started',
        requestId,
        method: request.method,
        path: request.path,
      }),
    );

    response.once('finish', () => {
      completionLogged = true;
      const statusCode = response.statusCode;
      const log = JSON.stringify({
        event:
          statusCode >= 400
            ? 'http.request.failed'
            : 'http.request.completed',
        requestId,
        method: request.method,
        path: request.path,
        statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      });

      if (statusCode >= 500) {
        this.logger.error(log);
      } else if (statusCode >= 400) {
        this.logger.warn(log);
      } else {
        this.logger.log(log);
      }
    });

    response.once('close', () => {
      if (completionLogged || response.writableEnded) return;
      this.logger.warn(
        JSON.stringify({
          event: 'http.request.aborted',
          requestId,
          method: request.method,
          path: request.path,
          durationMs: Math.round(performance.now() - startedAt),
        }),
      );
    });

    next();
  }
}

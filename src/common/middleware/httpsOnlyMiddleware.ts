import type { NextFunction, Request, Response } from 'express';

export function httpsOnlyMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (!request.secure) {
    response.status(426).json({
      status: 426,
      title: 'Upgrade Required',
      detail: 'Se requiere HTTPS para acceder a este servicio.',
      instance: request.originalUrl,
    });
    return;
  }
  next();
}

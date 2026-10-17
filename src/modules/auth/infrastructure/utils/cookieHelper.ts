import type { Request, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'refreshToken';

export function setRefreshTokenCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 3600 * 1000, // 7 días
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
}

export function extractRefreshToken(req: Request): string | undefined {
  if (req.cookies && req.cookies[REFRESH_COOKIE_NAME]) {
    return req.cookies[REFRESH_COOKIE_NAME];
  }

  const rawCookieHeader = req.headers?.cookie;
  if (rawCookieHeader) {
    const match = rawCookieHeader.match(
      new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE_NAME}=([^;]+)`),
    );
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  if (req.body && typeof req.body === 'object' && req.body.refreshToken) {
    return req.body.refreshToken;
  }

  return undefined;
}

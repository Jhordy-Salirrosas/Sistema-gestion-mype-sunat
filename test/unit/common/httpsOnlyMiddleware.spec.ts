import type { NextFunction, Request, Response } from 'express';
import { httpsOnlyMiddleware } from '../../../src/common/middleware/httpsOnlyMiddleware';

describe('httpsOnlyMiddleware', () => {
  it('rejects insecure requests without calling the next handler', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    httpsOnlyMiddleware(
      { secure: false, originalUrl: '/api/v1/auth/register' } as Request,
      { status, json } as unknown as Response,
      next,
    );

    expect(status).toHaveBeenCalledWith(426);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.stringContaining('HTTPS') }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows secure requests', () => {
    const status = jest.fn();
    const json = jest.fn();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    httpsOnlyMiddleware(
      { secure: true, originalUrl: '/api/v1/auth/register' } as Request,
      { status, json } as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });
});

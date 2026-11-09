import {
  BadGatewayException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  RetryableSireSunatError,
  SireReadOnlyPeriodsClient,
  SireTransportError,
} from '../../../src/modules/sire/infrastructure/sunat/sireReadOnlyPeriodsClient';

const config = {
  SUNAT_SIRE_INTEGRATION_ENABLED: 'true',
  SIRE_AUTH_HOST: 'https://api-seguridad.sunat.gob.pe',
  SIRE_API_HOST: 'https://api-sire.sunat.gob.pe',
  SUNAT_CLIENT_ID: 'fake-client-id',
  SUNAT_CLIENT_SECRET: 'fake-client-secret',
  SUNAT_SIRE_READONLY_TIMEOUT_MS: '10000',
};

function createClient(
  values: Record<string, string | boolean | undefined>,
  fetcher: typeof fetch = globalThis.fetch,
): SireReadOnlyPeriodsClient {
  const configService = {
    get: (name: string) => values[name],
  } as unknown as ConfigService;
  return new SireReadOnlyPeriodsClient(configService, fetcher);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SireReadOnlyPeriodsClient', () => {
  it('is disabled unless Homologation is explicitly configured', async () => {
    const fetcher = jest.fn();
    const client = createClient(
      { ...config, SUNAT_SIRE_INTEGRATION_ENABLED: 'false' },
      fetcher,
    );

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('gets an access token and queries RVIE periods without leaking secrets', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'fake-access-token' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          periodos: ['202601'],
          echoed: '20100070970FAKEUSER fake-sol-password',
          client_secret: 'fake-client-secret',
        }),
      );
    const client = createClient(config, fetcher);

    const result = await client.getPeriods(
      '20100070970',
      'FAKEUSER',
      'fake-sol-password',
      '140000',
    );

    expect(result).toEqual({
      periodos: ['202601'],
      echoed: '[REDACTED] [REDACTED]',
      client_secret: '[REDACTED]',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [tokenUrl, tokenRequest] = fetcher.mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(tokenUrl.pathname).toBe(
      '/v1/clientessol/fake-client-id/oauth2/token/',
    );
    expect(tokenRequest.method).toBe('POST');
    expect(tokenRequest.redirect).toBe('error');
    const tokenHeaders = new Headers(tokenRequest.headers);
    expect(tokenHeaders.get('content-type')).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(tokenHeaders.has('authorization')).toBe(false);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        'Body keys: grant_type, scope, client_id, client_secret, username, password',
      ),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        'POST https://api-seguridad.sunat.gob.pe/v1/clientessol/fake-client-id/oauth2/token/',
      ),
    );
    const tokenBody = new URLSearchParams(tokenRequest.body as URLSearchParams);
    expect(tokenBody.get('username')).toBe('20100070970FAKEUSER');
    expect(tokenBody.get('password')).toBe('fake-sol-password');
    expect(tokenBody.get('client_secret')).toBe('fake-client-secret');

    const [periodsUrl, periodsRequest] = fetcher.mock.calls[1] as [
      URL,
      RequestInit,
    ];
    expect(periodsUrl.pathname).toBe(
      '/v1/contribuyente/migeigv/libros/rvierce/padron/web/omisos/140000/periodos',
    );
    expect(periodsRequest.method).toBe('GET');
    expect(periodsRequest.redirect).toBe('error');
    expect(new Headers(periodsRequest.headers).get('authorization')).toMatch(
      /^Bearer \S+$/,
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvierce/padron/web/omisos/140000/periodos',
      ),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Authorization: Bearer [REDACTED]'),
    );
    expect(log.mock.calls.flat().join(' ')).not.toContain('fake-access-token');
    log.mockRestore();
    expect(new Headers(periodsRequest.headers).get('authorization')).toBe(
      'Bearer fake-access-token',
    );
  });

  it('trims RUC and SOL username before composing the OAuth username', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token' }))
      .mockResolvedValueOnce(jsonResponse({ periodos: [] }));
    const client = createClient(config, fetcher);

    await client.getPeriods(
      ' 20100070970 ',
      ' SIREAPII ',
      'fake-sol-password',
      '140000',
    );

    const [, tokenRequest] = fetcher.mock.calls[0] as [URL, RequestInit];
    const tokenBody = new URLSearchParams(tokenRequest.body as URLSearchParams);
    expect(tokenBody.get('username')).toBe('20100070970SIREAPII');
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        'Username enviado a SUNAT: [REDACTED] (RUC chars=11, usuario SOL chars=8, total chars=19, espacios exteriores eliminados=true)',
      ),
    );
    expect(log.mock.calls.flat().join(' ')).not.toContain(
      '20100070970SIREAPII',
    );
    expect(log.mock.calls.flat().join(' ')).not.toContain('SIREAPII');
    log.mockRestore();
  });

  it('uses the RCE endpoint for book code 080000', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token' }))
      .mockResolvedValueOnce(jsonResponse({ periodos: [] }));
    const client = createClient(config, fetcher);

    await client.getPeriods(
      '20100070970',
      'FAKEUSER',
      'fake-sol-password',
      '080000',
    );

    const [periodsUrl] = fetcher.mock.calls[1] as [URL, RequestInit];
    expect(periodsUrl.pathname).toBe(
      '/v1/contribuyente/migeigv/libros/rce/padron/web/omisos/080000/periodos',
    );
  });

  it('refreshes the token once after a 401 and retries the read-only request', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token-1' }))
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token-2' }))
      .mockResolvedValueOnce(jsonResponse({ periodos: ['202601'] }));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).resolves.toEqual({ periodos: ['202601'] });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('returns a sanitized validation error for SUNAT HTTP 422 responses', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token' }))
      .mockResolvedValueOnce(
        jsonResponse(
          { errors: [{ message: 'contains fake-sol-password' }] },
          422,
        ),
      );
    const client = createClient(config, fetcher);

    try {
      await client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      );
      throw new Error('Expected SUNAT validation response to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(
        JSON.stringify((error as UnprocessableEntityException).getResponse()),
      ).not.toContain('fake-sol-password');
    }
  });

  it('allows the official SUNAT authentication and SIRE hosts', async () => {
    const client = createClient(
      config,
      jest
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token' }))
        .mockResolvedValueOnce(jsonResponse({ periodos: [] })),
    );

    await client.getPeriods(
      '20100070970',
      'FAKEUSER',
      'fake-sol-password',
      '140000',
    );
  });

  it('rejects any host other than the official SIRE host', async () => {
    const client = createClient(
      {
        ...config,
        SIRE_API_HOST: 'https://api-other.sunat.gob.pe',
      },
      jest.fn(),
    );

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects a placeholder client ID before calling SUNAT', async () => {
    const fetcher = jest.fn();
    const client = createClient(
      { ...config, SUNAT_CLIENT_ID: 'tu-id-sin-espacios' },
      fetcher,
    );

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toThrow(/SUNAT_CLIENT_ID conserva un valor de ejemplo/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects invalid SOL credentials reported with HTTP 401', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(jsonResponse({}, 401));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logs a sanitized SUNAT OAuth error_description for HTTP 400', async () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const fetcher = jest.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          error: 'invalid_request',
          error_description:
            'Invalid request for fake-client-secret and fake-sol-password',
        },
        400,
      ),
    );
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 400'),
    );
    const loggedMessage = errorLog.mock.calls.flat().join(' ');
    expect(loggedMessage).toContain('[REDACTED]');
    expect(loggedMessage).not.toContain('fake-client-secret');
    expect(loggedMessage).not.toContain('fake-sol-password');
    errorLog.mockRestore();
  });

  it('preserves safe fetch diagnostics while redacting authentication secrets', async () => {
    const fetcher = jest.fn().mockRejectedValue(
      Object.assign(new TypeError('fetch failed with fake-client-secret'), {
        cause: Object.assign(new Error('connect failed fake-sol-password'), {
          code: 'ECONNREFUSED',
        }),
      }),
    );
    const client = createClient(config, fetcher);

    let thrown: unknown;
    try {
      await client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SireTransportError);
    if (!(thrown instanceof SireTransportError)) {
      throw new Error('Expected a safe SIRE transport error.');
    }

    expect(thrown.diagnostic).toContain('ECONNREFUSED');
    const diagnostic = thrown.diagnostic;
    expect(diagnostic).not.toContain('fake-client-secret');
    expect(diagnostic).not.toContain('fake-sol-password');
  });

  it.each([500, 502] as const)(
    'marks SUNAT HTTP %s responses as retryable',
    async (status) => {
      const fetcher = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token' }))
        .mockResolvedValueOnce(jsonResponse({ error: 'internal' }, status));
      const client = createClient(config, fetcher);

      try {
        await client.getPeriods(
          '20100070970',
          'FAKEUSER',
          'fake-sol-password',
          '140000',
        );
        throw new Error('Expected upstream failure.');
      } catch (error) {
        expect(error).toBeInstanceOf(RetryableSireSunatError);
        expect((error as RetryableSireSunatError).sunatStatus).toBe(status);
      }
    },
  );

  it.each([500, 502] as const)(
    'marks token endpoint HTTP %s responses as retryable',
    async (status) => {
      const fetcher = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse({ error: 'internal' }, status));
      const client = createClient(config, fetcher);

      await expect(
        client.getPeriods(
          '20100070970',
          'FAKEUSER',
          'fake-sol-password',
          '140000',
        ),
      ).rejects.toBeInstanceOf(RetryableSireSunatError);
    },
  );
});

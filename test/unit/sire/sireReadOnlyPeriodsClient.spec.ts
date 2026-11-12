import {
  BadGatewayException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  RetryableSireSunatError,
  SireConfigurationError,
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
    expect(log.mock.calls.flat().join(' ')).not.toContain('fake-access-token');
    log.mockRestore();
    expect(new Headers(periodsRequest.headers).get('authorization')).toBe(
      'Bearer fake-access-token',
    );
  });

  it('keeps the logs free of credentials, tokens and diagnostic fragments', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'fake-access-token' }),
      )
      .mockResolvedValueOnce(jsonResponse({ periodos: ['202601'] }));
    const client = createClient(config, fetcher);

    await client.getPeriods(
      '20100070970',
      'FAKEUSER',
      'fake-sol-password',
      '140000',
    );

    const loggedMessages = log.mock.calls.flat().join(' ');
    expect(loggedMessages).toContain('Iniciando consulta de períodos SIRE');
    expect(loggedMessages).toContain('Solicitando token de acceso');
    expect(loggedMessages).not.toContain('fake-access-token');
    expect(loggedMessages).not.toContain('fake-sol-password');
    expect(loggedMessages).not.toContain('fake-client-secret');
    expect(loggedMessages).not.toContain('fake-client-id');
    expect(loggedMessages).not.toContain('20100070970FAKEUSER');
    expect(loggedMessages).not.toMatch(/chars=/);
    expect(loggedMessages).not.toMatch(/Body keys/);
    expect(loggedMessages).not.toMatch(/Authorization/);
    log.mockRestore();
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
    ).rejects.toBeInstanceOf(BadRequestException);

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

  it.each([500, 502, 503] as const)(
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

  it('requires a RUC and a SOL username', async () => {
    const fetcher = jest.fn();
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods('  ', 'FAKEUSER', 'fake-sol-password', '140000'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      client.getPeriods('20100070970', '   ', 'fake-sol-password', '140000'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('confirms that the integration is configured without calling SUNAT', () => {
    const fetcher = jest.fn();
    const client = createClient(config, fetcher);

    expect(() => client.assertConfigured()).not.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a configuration without an application client id', async () => {
    const { SUNAT_CLIENT_ID: _omitted, ...sinClientId } = config;
    const client = createClient(sinClientId, jest.fn());

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(SireConfigurationError);
  });

  it('rejects a configuration without an application client secret', async () => {
    const { SUNAT_CLIENT_SECRET: _omitted, ...sinSecret } = config;
    const client = createClient(sinSecret, jest.fn());

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(SireConfigurationError);
  });

  it('rejects a configuration without the SUNAT hosts', async () => {
    const { SIRE_AUTH_HOST: _omitted, ...sinHost } = config;
    const client = createClient(sinHost, jest.fn());

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(SireConfigurationError);
  });

  it('rejects a URL that is not a valid URL', async () => {
    const client = createClient(
      { ...config, SIRE_API_HOST: 'no-es-una-url' },
      jest.fn(),
    );

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(SireConfigurationError);
  });

  it('rejects a URL with credentials, a path or a port', async () => {
    const rejectedUrls = [
      'https://usuario:clave@api-sire.sunat.gob.pe',
      'https://api-sire.sunat.gob.pe/ruta',
      'https://api-sire.sunat.gob.pe:8443',
      'https://api-sire.sunat.gob.pe/?parametro=1',
    ];

    for (const url of rejectedUrls) {
      const client = createClient({ ...config, SIRE_API_HOST: url }, jest.fn());
      await expect(
        client.getPeriods(
          '20100070970',
          'FAKEUSER',
          'fake-sol-password',
          '140000',
        ),
      ).rejects.toBeInstanceOf(SireConfigurationError);
    }
  });

  it('rejects a timeout outside the allowed range', async () => {
    const cliente = createClient(
      { ...config, SUNAT_SIRE_READONLY_TIMEOUT_MS: '10' },
      jest.fn(),
    );

    await expect(
      cliente.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(SireConfigurationError);
  });

  it('rejects a token response without an access token', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token_type: 'bearer' }));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects a token response with an empty access token', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: '' }));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects a validation error without description in the OAuth body', async () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'invalid_request' }, 400));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(errorLog.mock.calls.flat().join(' ')).toContain(
      'SUNAT no incluyó una descripción del error.',
    );
    errorLog.mockRestore();
  });

  it('rejects an OAuth error body that is not valid JSON', async () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        new Response('no es json', {
          status: 400,
          headers: { 'Content-Type': 'text/plain' },
        }),
      );
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(errorLog.mock.calls.flat().join(' ')).toContain(
      'SUNAT devolvió un cuerpo de error no válido.',
    );
    errorLog.mockRestore();
  });

  it('rejects a response whose body is not valid JSON', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token' }))
      .mockResolvedValueOnce(
        new Response('no es json', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
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
  });

  it('reports an unexpected SUNAT status as a bad gateway', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'not found' }, 404));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('reports a gateway timeout of SUNAT as unavailable', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'timeout' }, 504));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reports a validation failure of the token endpoint', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'invalid' }, 422));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('reports an unexpected status of the token endpoint as a bad gateway', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'not found' }, 404));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('reports a gateway timeout of the token endpoint as unavailable', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'timeout' }, 504));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('uses the default timeout when the environment does not set one', async () => {
    const { SUNAT_SIRE_READONLY_TIMEOUT_MS: _omitted, ...sinTimeout } =
      config;
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token' }))
      .mockResolvedValueOnce(jsonResponse({ periodos: [] }));
    const client = createClient(sinTimeout, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).resolves.toEqual({ periodos: [] });
  });

  it('uses the global fetch when no fetcher is injected', async () => {
    const globalFetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ periodos: [] }));
    const configService = {
      get: (name: string) => config[name as keyof typeof config],
    } as unknown as ConfigService;
    const client = new SireReadOnlyPeriodsClient(configService);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
      ),
    ).rejects.toBeInstanceOf(Error);
    expect(globalFetch).toHaveBeenCalled();
    globalFetch.mockRestore();
  });

  it('reports a validation error without an errors array', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-token' }))
      .mockResolvedValueOnce(jsonResponse({ detalle: 'sin lista' }, 422));
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

    expect(thrown).toBeInstanceOf(UnprocessableEntityException);
    expect(
      JSON.stringify((thrown as UnprocessableEntityException).getResponse()),
    ).toContain('"errorCount":0');
  });

  it('keeps a fetch failure whose cause is not an object', async () => {
    const fetcher = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new TypeError('fetch failed'), { cause: 'causa simple' }),
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
    expect((thrown as SireTransportError).diagnostic).toContain('fetch failed');
  });

  it('describes a fetch failure without name, message or code', async () => {
    const fetcher = jest.fn().mockRejectedValue({});
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
    expect((thrown as SireTransportError).diagnostic).toContain('FetchError');
  });

  it('describes a fetch failure that is not an object', async () => {
    const fetcher = jest.fn().mockRejectedValue('fallo sin forma');
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
    expect((thrown as SireTransportError).diagnostic).toBe(
      'Error de transporte sin detalles',
    );
  });
});

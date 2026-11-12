import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  RetryableSireSunatError,
  throwForSunatStatus,
  type SunatStatusMessages,
} from '../../../src/modules/sire/infrastructure/sunat/sunatErrors';

const mensajes: SunatStatusMessages = {
  unauthorized: 'no autorizado',
  unprocessable: 'no validable',
  serviceUnavailable: 'no disponible',
};

function respuesta(status: number): Response {
  return new Response(status === 204 ? null : '{}', {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('throwForSunatStatus', () => {
  it('does nothing when SUNAT answers with a successful status', () => {
    expect(() => throwForSunatStatus(respuesta(200), mensajes)).not.toThrow();
    expect(() => throwForSunatStatus(respuesta(204), mensajes)).not.toThrow();
  });

  it('rejects a 400 when the caller provides its own message', () => {
    expect(() =>
      throwForSunatStatus(respuesta(400), {
        ...mensajes,
        badRequest: 'solicitud rechazada',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects a 400 without a specific message as an unexpected status', () => {
    expect(() => throwForSunatStatus(respuesta(400), mensajes)).toThrow(
      BadGatewayException,
    );
  });

  it('rejects a 401', () => {
    expect(() => throwForSunatStatus(respuesta(401), mensajes)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a 422', () => {
    expect(() => throwForSunatStatus(respuesta(422), mensajes)).toThrow(
      UnprocessableEntityException,
    );
  });

  it.each([500, 502, 503] as const)(
    'marks the %s status as retryable',
    (status) => {
      let thrown: unknown;
      try {
        throwForSunatStatus(respuesta(status), mensajes);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(RetryableSireSunatError);
      expect((thrown as RetryableSireSunatError).sunatStatus).toBe(status);
    },
  );

  it('rejects any other 5xx as unavailable', () => {
    expect(() => throwForSunatStatus(respuesta(504), mensajes)).toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects an unexpected status', () => {
    expect(() => throwForSunatStatus(respuesta(404), mensajes)).toThrow(
      BadGatewayException,
    );
  });
});

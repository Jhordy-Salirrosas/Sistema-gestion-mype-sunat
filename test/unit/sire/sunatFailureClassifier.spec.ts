import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { classifySireSunatFailure } from '../../../src/modules/sire/infrastructure/sunat/sunatFailureClassifier';
import {
  RetryableSireSunatError,
  SireConfigurationError,
  SireTransportError,
} from '../../../src/modules/sire/infrastructure/sunat/sunatErrors';

describe('classifySireSunatFailure', () => {
  it('marks a 503 of SUNAT as retryable', () => {
    expect(classifySireSunatFailure(new RetryableSireSunatError(503))).toEqual({
      errorCode: 'SUNAT_HTTP_503',
      retryable: true,
    });
  });

  it('marks a timeout as retryable', () => {
    expect(
      classifySireSunatFailure(new SireTransportError('TimeoutError: aborted')),
    ).toEqual({
      errorCode: 'SUNAT_TIMEOUT',
      retryable: true,
    });
  });

  it('marks a network failure as retryable', () => {
    expect(
      classifySireSunatFailure(
        new SireTransportError('fetch failed: connect ECONNREFUSED'),
      ),
    ).toEqual({
      errorCode: 'SUNAT_TRANSPORT_ERROR',
      retryable: true,
    });
  });

  it('marks a configuration problem as not retryable', () => {
    expect(
      classifySireSunatFailure(
        new SireConfigurationError('La integración API SIRE no está configurada.'),
      ),
    ).toEqual({
      errorCode: 'SIRE_NOT_CONFIGURED',
      retryable: false,
    });
  });

  it('marks a rejected request as not retryable', () => {
    expect(classifySireSunatFailure(new BadRequestException('rechazada'))).toEqual(
      { errorCode: 'SUNAT_HTTP_400', retryable: false },
    );
  });

  it('marks rejected credentials as not retryable', () => {
    expect(classifySireSunatFailure(new UnauthorizedException('sin acceso'))).toEqual(
      { errorCode: 'SUNAT_AUTH_FAILED', retryable: false },
    );
  });

  it('marks a validation failure as not retryable', () => {
    expect(
      classifySireSunatFailure(new UnprocessableEntityException('inválida')),
    ).toEqual({ errorCode: 'SUNAT_HTTP_422', retryable: false });
  });

  it('marks an unavailable service as not retryable', () => {
    expect(
      classifySireSunatFailure(new ServiceUnavailableException('no disponible')),
    ).toEqual({ errorCode: 'SUNAT_UNAVAILABLE', retryable: false });
  });

  it('marks an unexpected response as not retryable', () => {
    expect(classifySireSunatFailure(new BadGatewayException('respuesta rara'))).toEqual(
      { errorCode: 'SUNAT_BAD_RESPONSE', retryable: false },
    );
  });

  it('marks an unknown failure as a generic request failure', () => {
    expect(classifySireSunatFailure(new Error('inesperado'))).toEqual({
      errorCode: 'SUNAT_REQUEST_FAILED',
      retryable: false,
    });
  });

  it('marks a value that is not an error as a generic request failure', () => {
    expect(classifySireSunatFailure('texto')).toEqual({
      errorCode: 'SUNAT_REQUEST_FAILED',
      retryable: false,
    });
  });
});

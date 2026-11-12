import {
  friendlySireFailureMessage,
  SIRE_FAILURE_MESSAGES,
  SIRE_GENERIC_FAILURE_MESSAGE,
  SIRE_PERIOD_ERROR_CODES,
  SIRE_QUEUE_UNAVAILABLE_MESSAGE,
  sunatHttpErrorCode,
} from '../../../src/modules/sire/domain/rules/sirePeriodFailureMessages';

describe('sirePeriodFailureMessages', () => {
  it('has a message for every catalogued error code', () => {
    const codes = Object.values(SIRE_PERIOD_ERROR_CODES);

    expect(codes.length).toBeGreaterThan(0);
    expect(Object.keys(SIRE_FAILURE_MESSAGES)).toHaveLength(codes.length);
    for (const code of codes) {
      expect(friendlySireFailureMessage(code)).not.toBe('');
    }
  });

  it('gives a specific message to every code but the generic one', () => {
    const specificCodes = Object.values(SIRE_PERIOD_ERROR_CODES).filter(
      (code) => code !== SIRE_PERIOD_ERROR_CODES.SUNAT_REQUEST_FAILED,
    );

    for (const code of specificCodes) {
      expect(friendlySireFailureMessage(code)).not.toBe(
        SIRE_GENERIC_FAILURE_MESSAGE,
      );
    }
  });

  it('returns the generic message for an unknown code', () => {
    expect(friendlySireFailureMessage('CODIGO_INVENTADO')).toBe(
      SIRE_GENERIC_FAILURE_MESSAGE,
    );
  });

  it('returns the generic message when there is no code', () => {
    expect(friendlySireFailureMessage(null)).toBe(SIRE_GENERIC_FAILURE_MESSAGE);
    expect(friendlySireFailureMessage(undefined)).toBe(
      SIRE_GENERIC_FAILURE_MESSAGE,
    );
  });

  it('maps the queue failure to the retry message', () => {
    expect(
      friendlySireFailureMessage(
        SIRE_PERIOD_ERROR_CODES.QUEUE_ENQUEUE_FAILED,
      ),
    ).toBe(SIRE_QUEUE_UNAVAILABLE_MESSAGE);
  });

  it('maps a retryable SUNAT status to its own code', () => {
    expect(sunatHttpErrorCode(500)).toBe(SIRE_PERIOD_ERROR_CODES.SUNAT_HTTP_500);
    expect(sunatHttpErrorCode(502)).toBe(SIRE_PERIOD_ERROR_CODES.SUNAT_HTTP_502);
    expect(sunatHttpErrorCode(503)).toBe(SIRE_PERIOD_ERROR_CODES.SUNAT_HTTP_503);
  });

  it('falls back to the generic code for a status without its own code', () => {
    expect(sunatHttpErrorCode(504)).toBe(
      SIRE_PERIOD_ERROR_CODES.SUNAT_REQUEST_FAILED,
    );
  });
});

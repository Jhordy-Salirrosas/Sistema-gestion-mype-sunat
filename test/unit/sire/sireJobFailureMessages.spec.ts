import {
  SIRE_JOB_ERROR_CODES,
  SIRE_JOB_FAILURE_MESSAGES,
  SIRE_JOB_GENERIC_FAILURE_MESSAGE,
  friendlySireJobFailureMessage,
} from '../../../src/modules/sire/domain/rules/sireJobFailureMessages';

describe('sireJobFailureMessages', () => {
  it('exposes a friendly message for every known error code', () => {
    for (const codigo of Object.values(SIRE_JOB_ERROR_CODES)) {
      expect(friendlySireJobFailureMessage(codigo)).toBe(
        SIRE_JOB_FAILURE_MESSAGES[codigo],
      );
      expect(friendlySireJobFailureMessage(codigo)).toEqual(expect.any(String));
      expect(friendlySireJobFailureMessage(codigo)?.length).toBeGreaterThan(0);
    }
  });

  it('returns null when the job has not failed', () => {
    expect(friendlySireJobFailureMessage(null)).toBeNull();
    expect(friendlySireJobFailureMessage(undefined)).toBeNull();
    expect(friendlySireJobFailureMessage('')).toBeNull();
  });

  it('never leaks internal details for an unknown code', () => {
    const mensaje = friendlySireJobFailureMessage('ERROR_INTERNO_DESCONOCIDO');

    expect(mensaje).toBe(SIRE_JOB_GENERIC_FAILURE_MESSAGE);
    expect(mensaje).not.toContain('ERROR_INTERNO_DESCONOCIDO');
  });

  it('explains that a queue failure can be retried', () => {
    expect(
      friendlySireJobFailureMessage(SIRE_JOB_ERROR_CODES.QUEUE_ENQUEUE_FAILED),
    ).toContain('cola');
  });

  it('explains that exhausted retries moved the job to the dead letter queue', () => {
    expect(
      friendlySireJobFailureMessage(SIRE_JOB_ERROR_CODES.SIRE_RETRIES_EXHAUSTED),
    ).toContain('cola de errores');
  });
});

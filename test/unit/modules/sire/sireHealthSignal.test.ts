import { describe, expect, it } from 'vitest';
import { getSireHealthSignal } from '@/modules/sire/lib/sireHealthSignal';

describe('getSireHealthSignal', () => {
  it('maps the zero-error threshold to green', () => {
    expect(getSireHealthSignal(0, 'CLOSED')).toBe('green');
  });

  it.each([1, 4])('maps %i recent errors to amber', (count) => {
    expect(getSireHealthSignal(count, 'CLOSED')).toBe('amber');
  });

  it.each([5, 8])('maps %i recent errors to red', (count) => {
    expect(getSireHealthSignal(count, 'HALF_OPEN')).toBe('red');
  });

  it('maps an open circuit to red regardless of recent errors', () => {
    expect(getSireHealthSignal(undefined, 'OPEN')).toBe('red');
  });

  it('does not infer a color when recent error count is absent or invalid', () => {
    expect(getSireHealthSignal(undefined, 'CLOSED')).toBe('unknown');
    expect(getSireHealthSignal(-1, 'CLOSED')).toBe('unknown');
  });
});

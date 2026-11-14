import {
  toApiBookType,
  toDomainBookType,
} from '../../../src/modules/sire/application/sireBookType';

describe('sireBookType', () => {
  describe('toDomainBookType', () => {
    it('maps the sales book to the domain RVIE', () => {
      expect(toDomainBookType('RVIE_VENTAS')).toBe('RVIE');
    });

    it('maps the purchases book to the domain RCE', () => {
      expect(toDomainBookType('RCE_COMPRAS')).toBe('RCE');
    });

    it('falls back to RCE for an unknown book', () => {
      expect(toDomainBookType('OTRO' as never)).toBe('RCE');
    });
  });

  describe('toApiBookType', () => {
    it('maps the domain RVIE to the sales book', () => {
      expect(toApiBookType('RVIE')).toBe('RVIE_VENTAS');
    });

    it('maps the domain RCE to the purchases book', () => {
      expect(toApiBookType('RCE')).toBe('RCE_COMPRAS');
    });

    it('falls back to the purchases book for an unknown domain book', () => {
      expect(toApiBookType('OTRO' as never)).toBe('RCE_COMPRAS');
    });
  });

  it('is the inverse of each other for the supported books', () => {
    expect(toApiBookType(toDomainBookType('RVIE_VENTAS'))).toBe('RVIE_VENTAS');
    expect(toApiBookType(toDomainBookType('RCE_COMPRAS'))).toBe('RCE_COMPRAS');
  });
});

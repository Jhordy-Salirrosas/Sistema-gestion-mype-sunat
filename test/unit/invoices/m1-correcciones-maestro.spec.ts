import { MasterDataService } from '../../../src/modules/customs/application/services/masterDataService';

function montar() {
  const businessPartner = {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn(async ({ data }) => data),
    update: jest.fn(async ({ data }) => data),
  };
  return {
    businessPartner,
    service: new MasterDataService({ businessPartner } as never),
  };
}
const base = { docType: '6', docNumber: '20100070970', legalName: 'Cliente' };
describe('M1 permisos comerciales del maestro', () => {
  it.each([true, false, null])(
    'persiste hasCredit y allowsDiscount explícitos %s sin reemplazarlos por paymentTerms',
    async (flag) => {
      const { service, businessPartner } = montar();
      const result = await service.createPartner('empresa', {
        ...base,
        hasCredit: flag,
        allowsDiscount: flag,
        paymentTerms: '30_DIAS',
      } as never);
      expect(result).toMatchObject({
        company_id: 'empresa',
        has_credit: flag,
        allows_discount: flag,
      });
      expect(businessPartner.findFirst).toHaveBeenCalledWith({
        where: {
          company_id: 'empresa',
          doc_type: '6',
          doc_number: base.docNumber,
        },
      });
    },
  );
  it('sin permisos ni términos guarda null, sin habilitar descuentos o crédito', async () => {
    const { service } = montar();
    expect(await service.createPartner('empresa', base as never)).toMatchObject(
      { has_credit: null, allows_discount: null },
    );
  });
  it.each([
    ['CONTADO', false],
    ['30_DIAS', true],
    ['', null],
  ])(
    'alta compatible con términos %s produce crédito %s',
    async (paymentTerms, expected) => {
      const { service } = montar();
      expect(
        await service.createPartner('empresa', {
          ...base,
          paymentTerms,
        } as never),
      ).toMatchObject({ has_credit: expected, allows_discount: null });
    },
  );
  it.each([true, false, null])(
    'actualiza permisos explícitos %s aunque existan términos al crédito',
    async (flag) => {
      const { service, businessPartner } = montar();
      businessPartner.findFirst.mockResolvedValue({ id: 'cliente' });
      expect(
        await service.updatePartner('empresa', 'cliente', {
          hasCredit: flag,
          allowsDiscount: flag,
          paymentTerms: '30_DIAS',
        } as never),
      ).toEqual({
        has_credit: flag,
        allows_discount: flag,
        payment_terms: '30_DIAS',
      });
      expect(businessPartner.findFirst.mock.calls[0][0].where).toEqual({
        id: 'cliente',
        company_id: 'empresa',
      });
    },
  );
  it.each([
    ['CONTADO', false],
    ['30_DIAS', true],
    [null, null],
  ])(
    'actualizar términos %s recalcula permiso heredado %s',
    async (paymentTerms, expected) => {
      const { service, businessPartner } = montar();
      businessPartner.findFirst.mockResolvedValue({ id: 'cliente' });
      expect(
        await service.updatePartner('empresa', 'cliente', {
          paymentTerms,
        } as never),
      ).toEqual({ payment_terms: paymentTerms, has_credit: expected });
    },
  );
  it('editar nombre no altera permisos existentes', async () => {
    const { service, businessPartner } = montar();
    businessPartner.findFirst.mockResolvedValue({
      id: 'cliente',
      has_credit: true,
      allows_discount: true,
    });
    expect(
      await service.updatePartner('empresa', 'cliente', { legalName: 'Nuevo' }),
    ).toEqual({ legal_name: 'Nuevo' });
  });
});

import { describe, expect, it, jest } from '@jest/globals';
import { resolverRetencionMaestro } from '../../../src/modules/invoices/application/services/retencionMaestro';

const ahora = new Date('2026-11-06T12:00:00Z');
type Registro = { value: boolean; valid_from: Date; valid_to: Date | null };
const vigente: Registro = { value: true, valid_from: new Date('2026-01-01'), valid_to: null };
function base(registros: Registro[], existe = true) {
  return {
    businessPartner: { findFirst: jest.fn(async (_args: unknown) => existe ? { id: 'p1' } : null) },
    partnerTaxStatus: { findFirst: jest.fn(async (_args: unknown) => registros.find((r) => r.valid_from <= ahora && (!r.valid_to || r.valid_to >= ahora)) ?? null) },
  };
}
const datos = { companyId: 'empresa', tipo: '6', numero: '20601234567', fecha: ahora, enviado: false };

describe('determinación de retención desde el maestro', () => {
  it.each([true, false])('aplica el indicador vigente %s sin corrección explícita', async (value) => {
    const db = base([{ ...vigente, value }]);
    const r = await resolverRetencionMaestro(db as never, datos);
    expect(r).toMatchObject({ aplica: value, origen: 'MAESTRO' });
    expect(db.businessPartner.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { company_id: 'empresa', doc_type: '6', doc_number: '20601234567' } }));
    expect(db.partnerTaxStatus.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { partner_id: 'p1', indicator: 'RETENCION', valid_from: { lte: ahora }, OR: [{ valid_to: null }, { valid_to: { gte: ahora } }] } }));
  });
  it.each([
    { ...vigente, valid_from: new Date('2026-12-01') },
    { ...vigente, valid_to: new Date('2026-11-05') },
  ])('usa selección manual cuando no hay vigencia', async (registro) => {
    expect(await resolverRetencionMaestro(base([registro]) as never, { ...datos, enviado: true })).toMatchObject({ aplica: true, origen: 'MANUAL_SIN_DATO' });
  });
  it('conserva la ruta manual si no existe el cliente', async () => {
    expect(await resolverRetencionMaestro(base([], false) as never, { ...datos, enviado: true })).toMatchObject({ aplica: true, origen: 'MANUAL_SIN_DATO' });
  });
  it('aplica y explica una corrección manual explícita', async () => {
    expect(await resolverRetencionMaestro(base([vigente]) as never, { ...datos, correccion: true })).toMatchObject({ aplica: false, origen: 'CORRECCION_MANUAL', maestro: true });
  });
});

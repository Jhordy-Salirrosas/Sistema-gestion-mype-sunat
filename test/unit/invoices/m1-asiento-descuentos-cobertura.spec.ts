import { describe, expect, it, jest } from '@jest/globals';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { balanceAsiento, lineasAsientoVenta } from '../../../src/modules/invoices/application/services/accountingBridge';

const item = { quantity: 1, unit_value: 1000, igv_affectation_type: '10' };
const payloadBase = {
  lineas: [{ descuentos: [{ codigo: '01', monto: 100 }] }],
  lineasTributarias: [{ afectacion: '10', valorVenta: 1000, igv: 180 }],
  montoTotal: 1080,
};

function consumidor(payload: unknown, resultado: Record<string, unknown> = {}) {
  const registrar = jest.fn(async (_factura: unknown) => ({ movimientosRegistrados: 0, movimientosOmitidos: 0,
    asientoOmitido: false, errores: [], completo: false, ...resultado }));
  const execute = jest.fn();
  const fila = { id: 'inv-1', company_id: 'empresa', tipo_comprobante: '01', serie: 'F001', correlativo: 1,
    fecha_emision: new Date('2026-03-15T00:00:00Z'), payload_ubl: payload, items: [item] };
  const instancia = new InvoiceJobConsumer({} as never, {} as never,
    { invoice: { findUnique: jest.fn(async () => fila) } } as never,
    {} as never, {} as never, { verifySignature: jest.fn(() => true) } as never, {} as never, {} as never,
    { registrar } as never, {} as never, { execute } as never);
  const interno = instancia as unknown as {
    registrarEnContabilidad(id: string, estado: InvoiceStatus): Promise<void>;
    liquidarParaPuente(items: unknown[], payload: unknown): Record<string, number>;
    logger: { warn: (mensaje: string) => void };
  };
  const advertir = jest.spyOn(interno.logger, 'warn').mockImplementation(() => undefined);
  return { interno, registrar, execute, advertir };
}

describe('casos de revisión del asiento con descuentos 01/03', () => {
  it.each([
    ['texto 01', '01', '100'], ['NaN 01', '01', NaN], ['infinito 03', '03', Infinity],
    ['cero 03', '03', 0], ['negativo 01', '01', -1],
  ])('deja en revisión el monto inválido %s', async (_caso, codigo, monto) => {
    const payload = { ...payloadBase,
      lineas: [{ descuentos: codigo === '01' ? [{ codigo, monto }] : [] }],
      descuentoGlobal: codigo === '03' ? { codigo, monto } : undefined };
    const { interno, registrar, execute, advertir } = consumidor(payload);
    await interno.registrarEnContabilidad('inv-1', InvoiceStatus.ACEPTADO);
    expect(advertir).toHaveBeenCalledWith(expect.stringContaining('Descuento 01/03 inválido: requiere revisión contable'));
    expect(advertir).toHaveBeenCalledWith(expect.stringContaining('asiento automático omitido'));
    expect(registrar).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    advertir.mockRestore();
  });

  it.each([
    ['otro descuento distinto', { otrosDescuentos: 99 }, 'Los descuentos declarados no concuerdan'],
    ['otro descuento no numérico', { otrosDescuentos: '100' }, 'Los descuentos declarados no concuerdan'],
    ['otro descuento no finito', { otrosDescuentos: Infinity }, 'Los descuentos declarados no concuerdan'],
    ['total distinto', { montoTotal: 1079 }, 'El total del comprobante no concuerda'],
    ['total negativo', { lineas: [{ descuentos: [{ codigo: '01', monto: 1200 }] }], montoTotal: -20 }, 'El total del comprobante no concuerda'],
  ])('deja en revisión si hay %s', async (_caso, cambios, mensaje) => {
    const { interno, registrar, execute, advertir } = consumidor({ ...payloadBase, ...cambios });
    await interno.registrarEnContabilidad('inv-1', InvoiceStatus.ACEPTADO);
    expect(advertir).toHaveBeenCalledWith(expect.stringContaining(mensaje));
    expect(advertir).toHaveBeenCalledWith(expect.stringContaining('asiento automático omitido'));
    expect(registrar).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    advertir.mockRestore();
  });

  it.each(['01', '03'])('calcula descuento %s desde ítems sin líneas tributarias', (codigo) => {
    const payload = { lineas: [{ descuentos: codigo === '01' ? [{ codigo, monto: 100 }] : [] }],
      descuentoGlobal: codigo === '03' ? { codigo, monto: 100 } : undefined,
      otrosDescuentos: 100, montoTotal: 1080 };
    const { interno, advertir } = consumidor(payload);
    expect(interno.liquidarParaPuente([item], payload)).toMatchObject({ gravado: 1000, igv: 180, descuentoNoAfecto: 100, total: 1080 });
    advertir.mockRestore();
  });

  it('advierte y no usa el respaldo si el puente no produce asiento con descuento', async () => {
    const { interno, registrar, execute, advertir } = consumidor(payloadBase);
    await interno.registrarEnContabilidad('inv-1', InvoiceStatus.ACEPTADO);
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ importes: expect.objectContaining({ descuentoNoAfecto: 100 }) }));
    expect(advertir).toHaveBeenCalledWith(expect.stringContaining('asiento automático omitido'));
    expect(execute).not.toHaveBeenCalled();
    advertir.mockRestore();
  });

  it('cuadra descuento junto con detracción y retención', () => {
    const lineas = lineasAsientoVenta({ gravado: 1000, igv: 180, exonerado: 0, inafecto: 0,
      icbper: 0, detraccion: 47.2, retencion: 32.4, total: 1080, descuentoNoAfecto: 100 });
    expect(lineas).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountCode: '12121', debitAmount: 1000.4 }),
      expect.objectContaining({ accountCode: '74', debitAmount: 100 }),
      expect.objectContaining({ accountCode: '12129', debitAmount: 47.2 }),
      expect.objectContaining({ accountCode: '40114', debitAmount: 32.4 }),
      expect.objectContaining({ accountCode: '70121', creditAmount: 1000 }),
      expect.objectContaining({ accountCode: '40111', creditAmount: 180 }),
    ]));
    expect(balanceAsiento(lineas)).toEqual({ debe: 1180, haber: 1180, cuadra: true });
  });
});

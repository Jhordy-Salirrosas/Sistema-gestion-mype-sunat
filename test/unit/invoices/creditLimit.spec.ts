import { BadRequestException } from '@nestjs/common';
import { validarLimiteCredito } from '../../../src/modules/invoices/application/services/creationGuards';

const dto = { forma_pago: 'Credito', tipo_comprobante: '01', customer_identity_type: '6', customer_identity_number: '20100070970' } as any;

function tx(over: Record<string, any> = {}) {
  return {
    businessPartner: { findFirst: jest.fn().mockResolvedValue({ credit_limit: 1000, has_credit: true }) },
    invoice: {
      findMany: jest.fn().mockResolvedValue([{ id: 'f1', monto_total: 600 }]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { monto_total: 50 } }),
    },
    collection: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 100 } }) },
    ...over,
  } as any;
}

describe('validarLimiteCredito', () => {
  it('permite si el saldo más la venta no supera el límite', async () => {
    await expect(validarLimiteCredito(tx(), 'c1', dto, 400)).resolves.toBeUndefined();
  });

  it('bloquea si el saldo más la venta supera el límite', async () => {
    await expect(validarLimiteCredito(tx(), 'c1', dto, 700)).rejects.toBeInstanceOf(BadRequestException);
    await expect(validarLimiteCredito(tx(), 'c1', dto, 700)).rejects.toThrow('Disponible: S/ 550.00');
  });

  it('no valida contado, notas ni clientes sin límite', async () => {
    await expect(validarLimiteCredito(tx(), 'c1', { ...dto, forma_pago: 'Contado' }, 9999)).resolves.toBeUndefined();
    await expect(validarLimiteCredito(tx(), 'c1', { ...dto, tipo_comprobante: '07' }, 9999)).resolves.toBeUndefined();
    const sinLimite = tx({ businessPartner: { findFirst: jest.fn().mockResolvedValue({ credit_limit: null, has_credit: true }) } });
    await expect(validarLimiteCredito(sinLimite, 'c1', dto, 9999)).resolves.toBeUndefined();
  });

  it('calcula sin facturas previas', async () => {
    const vacio = tx({ invoice: { findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn() }, collection: { aggregate: jest.fn() } });
    await expect(validarLimiteCredito(vacio, 'c1', dto, 900)).resolves.toBeUndefined();
  });
});

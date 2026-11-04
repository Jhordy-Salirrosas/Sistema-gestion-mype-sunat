/**
 * TA-61 · buscador de clientes.
 *
 * Protege tres decisiones que se rompen fácil:
 *
 *  1. Un número se busca por DOCUMENTO y no por razón social: quien teclea
 *     "2010" espera el RUC que empieza así, no un cliente cuyo nombre contenga
 *     esos dígitos.
 *  2. Las tildes no cuentan: "PEREZ" tiene que encontrar "PÉREZ".
 *  3. Con una sola letra no se busca: la lista no cabe ni sirve.
 */
import { describe, expect, it, jest } from '@jest/globals';
import {
  filtrarCartera,
  LIMITE_RESULTADOS,
  MINIMO_CARACTERES,
  normalizar,
  InvoiceCustomerService,
  type ClienteEncontrado,
} from '../../../src/modules/invoices/application/services/invoiceCustomerService';

const CARTERA: ClienteEncontrado[] = [
  { tipoDocumento: '6', numeroDocumento: '20100066603', razonSocial: 'FERRETERIA LOS ANDES S.A.C.' },
  { tipoDocumento: '6', numeroDocumento: '20553510661', razonSocial: 'PÉREZ CONSTRUCCIONES E.I.R.L.' },
  { tipoDocumento: '1', numeroDocumento: '70123456', razonSocial: 'Juana Quispe' },
  { tipoDocumento: '6', numeroDocumento: '20123456789', razonSocial: 'DISTRIBUIDORA SAN MARTIN' },
];

describe('TA-61 · filtrado de la cartera', () => {
  it('busca por documento cuando el texto es solo dígitos', () => {
    const r = filtrarCartera(CARTERA, '2055');
    expect(r).toHaveLength(1);
    expect(r[0].numeroDocumento).toBe('20553510661');
  });

  it('encuentra por prefijo de documento', () => {
    const r = filtrarCartera(CARTERA, '70');
    expect(r.map((c) => c.numeroDocumento)).toEqual(['70123456']);
  });

  it('no confunde un documento con un nombre que contiene esos dígitos', () => {
    // "201" aparece dentro de varios nombres, pero como texto es un documento.
    const r = filtrarCartera(CARTERA, '201');
    expect(r.every((c) => c.numeroDocumento.startsWith('201'))).toBe(true);
  });

  it('busca por razón social ignorando tildes', () => {
    const r = filtrarCartera(CARTERA, 'perez');
    expect(r).toHaveLength(1);
    expect(r[0].razonSocial).toContain('PÉREZ');
  });

  it('busca por razón social ignorando mayúsculas', () => {
    const r = filtrarCartera(CARTERA, 'ferreteria');
    expect(r).toHaveLength(1);
  });

  it('encuentra una coincidencia en medio del nombre', () => {
    const r = filtrarCartera(CARTERA, 'andes');
    expect(r[0].razonSocial).toContain('ANDES');
  });

  it('con una sola letra no devuelve nada', () => {
    expect(filtrarCartera(CARTERA, 'f')).toHaveLength(0);
    expect(MINIMO_CARACTERES).toBe(2);
  });

  it('con dos letras ya busca', () => {
    expect(filtrarCartera(CARTERA, 'fe')).toHaveLength(1);
  });

  it('con texto vacío devuelve la lista vacía', () => {
    expect(filtrarCartera(CARTERA, '')).toHaveLength(0);
    expect(filtrarCartera(CARTERA, '   ')).toHaveLength(0);
  });

  it('respeta el límite de resultados', () => {
    const muchos = Array.from({ length: 50 }, (_, i) => ({
      tipoDocumento: '6',
      numeroDocumento: `2010000000${i}`,
      razonSocial: `CLIENTE ${i}`,
    }));
    expect(filtrarCartera(muchos, 'cliente')).toHaveLength(LIMITE_RESULTADOS);
  });

  it('normaliza tildes también en el texto y en el dato', () => {
    expect(normalizar('PÉREZ')).toBe('perez');
    expect(normalizar('  ÁRBOL  ')).toBe('arbol');
    expect(normalizar('')).toBe('');
  });
});

describe('TA-61 · InvoiceCustomerService', () => {
  const prismaFalso = (filas: Record<string, unknown>[]) => ({
    invoice: {
      findMany: jest.fn(async (_args?: unknown) => filas),
    },
  });

  it('deduplica por número de documento', async () => {
    const prisma = prismaFalso([
      { customer_identity_type: '6', customer_identity_number: '20100066603', customer_legal_name: 'NUEVO NOMBRE' },
      { customer_identity_type: '6', customer_identity_number: '20100066603', customer_legal_name: 'NOMBRE VIEJO' },
      { customer_identity_type: '1', customer_identity_number: '70123456', customer_legal_name: 'Juana' },
    ]);
    const servicio = new InvoiceCustomerService(prisma as never);

    const cartera = await servicio.cartera('emp-1');
    expect(cartera).toHaveLength(2);
    // Gana la aparición más reciente (el orden ya viene descendente).
    expect(cartera[0].razonSocial).toBe('NUEVO NOMBRE');
  });

  it('ignora comprobantes sin documento del adquirente', async () => {
    const prisma = prismaFalso([
      { customer_identity_type: '6', customer_identity_number: '', customer_legal_name: 'X' },
      { customer_identity_type: null, customer_identity_number: null, customer_legal_name: 'Y' },
      { customer_identity_type: '1', customer_identity_number: '70123456', customer_legal_name: 'Juana' },
    ]);
    const servicio = new InvoiceCustomerService(prisma as never);

    const cartera = await servicio.cartera('emp-1');
    expect(cartera).toHaveLength(1);
    expect(cartera[0].numeroDocumento).toBe('70123456');
  });

  it('filtra la cartera al buscar', async () => {
    const prisma = prismaFalso([
      { customer_identity_type: '6', customer_identity_number: '20100066603', customer_legal_name: 'FERRETERIA LOS ANDES' },
      { customer_identity_type: '1', customer_identity_number: '70123456', customer_legal_name: 'Juana Quispe' },
    ]);
    const servicio = new InvoiceCustomerService(prisma as never);

    const r = await servicio.buscar('emp-1', 'andes');
    expect(r).toHaveLength(1);
    expect(r[0].razonSocial).toContain('ANDES');
  });

  it('filtra por empresa: el tenant no se toma del cliente HTTP', async () => {
    const prisma = prismaFalso([]);
    const servicio = new InvoiceCustomerService(prisma as never);

    await servicio.cartera('emp-42');
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ company_id: 'emp-42' }),
      }),
    );
  });

  it('sin resultados devuelve un arreglo vacío y no undefined', async () => {
    const servicio = new InvoiceCustomerService(prismaFalso([]) as never);
    expect(await servicio.buscar('emp-1', 'zzz')).toEqual([]);
  });
});

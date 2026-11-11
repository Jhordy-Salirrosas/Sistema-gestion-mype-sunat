import { fiscalToEmission } from '../../../src/modules/invoices/application/services/creationGuards';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { harness, nota } from '../../fixtures/noteCreationHarness';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';

it.each(['07', '08'])('deriva ausente/blanca y conserva personalizada en ambas rutas: %s', async tipo => {
  for (const descripcion of [undefined, '  ', 'Mi motivo']) {
    const dto = { ...nota(), tipo_comprobante: tipo, codigo_motivo_nota: tipo === '07' ? '06' : '01', descripcion_motivo_nota: descripcion };
    const expected = descripcion?.trim() ? descripcion : tipo === '07' ? 'Devolución total' : 'Intereses por mora';
    const translated = traducirEmision({ ...dto, items: dto.items.map(l => ({ ...l, afectacion: '10', unidad: 'NIU' })) } as never, { ruc: '20000000001', razonSocial: 'Empresa' }, 1);
    expect(translated.dto.payload_ubl.descripcionMotivoNota).toBe(expected);
    const fiscal = { ...translated.dto, payload_ubl: { ...translated.dto.payload_ubl, descripcionMotivoNota: descripcion } };
    expect(fiscalToEmission(fiscal).descripcion_motivo_nota).toBe(expected);
    expect((await harness().run(dto)).descripcion_motivo_nota).toBe(expected);
  }
});
it.each([['99', 'MOTIVO_INVALIDO'], ['08', 'MOTIVO_NO_HABILITADO']])('no deriva ni habilita motivo %s', (codigo, code) => {
  try { traducirEmision({ ...nota(), codigo_motivo_nota: codigo } as never, { ruc: 'x', razonSocial: 'x' }, 1); throw new Error('aceptado'); }
  catch (e: any) { expect(e.getResponse().code).toBe(code); }
});
it('preparación completa el payload almacenado y audita antes de generar; el trabajo continúa', async () => {
  const row = { id: 'nota', company_id: 'empresa', tipo_comprobante: '07', estado: 'ERROR_RED', ruc_emisor: '20000000001', serie: 'FC01', correlativo: 16, xml_storage_url: null,
    payload_ubl: { tipoComprobante: '07', codigoMotivoNota: '06' } };
  const history = jest.fn(async () => ({}));
  const update = jest.fn(async ({ data }) => { Object.assign(row, data); return row; });
  const tx = { $executeRaw: jest.fn(), invoice: { findUniqueOrThrow: jest.fn(async () => row), update }, transactionHistory: { create: history } };
  const prisma = { invoice: { findUnique: jest.fn(async () => row) }, $transaction: jest.fn(async f => f(tx)) };
  const generate = jest.fn(p => { expect(history).toHaveBeenCalledTimes(1); expect(p.descripcionMotivoNota).toBe('Devolución total'); return '<?xml?><CreditNote/>'; });
  const retry = { processWithRetry: jest.fn(async () => null) };
  const consumer = new InvoiceJobConsumer({} as never, retry as never, prisma as never,
    { generateInvoiceXml: generate } as never, { validateInvoiceUbl21: () => ({ isValid: true }) } as never,
    { signXml: (xml: string) => ({ signedXml: xml + '<ds:Signature/>' }), verifySignature: () => true } as never,
    { validar: async () => ({ valido: true, errores: [], codigosDesconocidos: [], bloqueado: false }) } as never,
    {} as never, {} as never, { guardar: async () => 'hash' } as never);
  await consumer.procesar({ invoice_id: 'nota' });
  expect(retry.processWithRetry).toHaveBeenCalledTimes(1);
  expect(history).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ codigo_error: 'M1_NOTE_DESCRIPTION_COMPLETED', estado_nuevo: 'ERROR_RED' }) }));
  await consumer.preparar('nota');
  expect(history).toHaveBeenCalledTimes(1);
});

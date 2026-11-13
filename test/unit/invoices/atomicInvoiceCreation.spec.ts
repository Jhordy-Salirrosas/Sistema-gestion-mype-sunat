import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { fakeFiscalAddress } from '../../fixtures/fakeFiscalAddress';
import { AtomicInvoiceCreationService } from '../../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { ConflictException } from '@nestjs/common';

const fiscal = { ruc_emisor: '20100070970', tipo_comprobante: '01', serie: 'F001', correlativo: 1,
  monto_total: 118, fecha_emision: '2026-11-08', customer_identity_type: '6',
  customer_identity_number: '20100070970', customer_legal_name: 'Cliente', payload_ubl: { rucEmisor: '20100070970', tipoComprobante: '01', serie: 'F001',
    fechaEmision: '2026-11-08', formaPago: 'Contado', tipoMoneda: 'PEN',
    lineas: [{ codigo: 'SERV', descripcion: 'Servicio', cantidad: 1, precioUnitario: 118, afectacion: '10' }] } };
const pantalla = { tipo_comprobante: '01', serie: 'F001', customer_identity_type: '6',
  customer_identity_number: '20100070970', customer_legal_name: 'Cliente',
  forma_pago: 'Contado',
  items: [{ codigo: 'SERV', descripcion: 'Servicio', cantidad: 1, precioUnitario: 118, afectacion: '10' }] };

function harness() {
  const requests = new Map<string, any>();
  const tx = { inventoryWarehouse: { findFirst: jest.fn(async () => ({ id: 'warehouse' })) },
    $executeRaw: jest.fn(async () => 1),
    $queryRaw: jest.fn(async () => [{ current_correlative: 10 }]),
    invoiceCreationRequest: {
      findUnique: jest.fn(async ({ where }: any) => requests.get(JSON.stringify(where))),
      findUniqueOrThrow: jest.fn(async () => ({ id: 'inv-10', estado: 'PENDIENTE', created_at: new Date('2026-11-08') })),
      create: jest.fn(async ({ data }: any) => {
        requests.set(JSON.stringify({ company_id_request_key: { company_id: data.company_id, request_key: data.request_key } }), data);
      }),
    },
    company: { findUnique: jest.fn(async () => ({ ruc: '20100070970', legal_name: 'Empresa', ...fakeFiscalAddress })) },
    businessPartner: { findFirst: jest.fn(async () => null) },
    inventoryProduct: { findMany: jest.fn(async () => [{ sale_price: 118, id: 'p1', sku: 'SERV', description: 'Servicio', sunat_unit_code: 'NIU', tax_affectation: '10', is_inventory: false }]) },
    inventoryBalance: { groupBy: jest.fn(async () => []) },
    invoice: {
      findUniqueOrThrow: jest.fn(async () => ({ id: 'inv-10', estado: 'PENDIENTE', created_at: new Date('2026-11-08') })),
      create: jest.fn(async ({ data }: any) => ({ ...data, id: 'inv-10', estado: 'PENDIENTE', created_at: new Date('2026-11-08') })),
      update: jest.fn(async () => ({})),
    },
    invoiceItem: { createMany: jest.fn(async () => ({ count: 1 })) },
    transactionHistory: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn(async (work: any) => work(tx)) };
  const queue = { enqueueInvoiceInTx: jest.fn(async () => 'job-10') };
  return { tx, prisma, queue, service: new AtomicInvoiceCreationService(prisma as never, queue as never) };
}

it.each([undefined, '', 'short', 'invalid space request'])(
  'rechaza una clave inválida sin abrir transacción: %s', async (key) => {
    const h = harness();
    await expect(h.service.create(fiscal as never, 'empresa', key)).rejects.toThrow('Idempotency-Key');
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  },
);
it('exige tenant antes de abrir transacción', async () => {
  await expect(harness().service.create(fiscal as never, '', 'request-key-00001')).rejects.toThrow('ISSUER_COMPANY_REQUIRED');
});
it('reserva serie y crea evento usando el mismo cliente de la transacción exterior', async () => {
  const h = harness();
  const result = await h.service.create(fiscal as never, 'empresa', 'request-key-00001');
  expect(result.id).toBe('inv-10');
  expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
  expect(h.queue.enqueueInvoiceInTx).toHaveBeenCalledWith(h.tx, 'inv-10');
  expect(h.tx.invoice.create.mock.calls[0][0].data.correlativo).toBe(10);
  expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(h.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(h.tx.invoice.create.mock.invocationCallOrder[0]);
});
it('reintento posterior recupera respuesta durable sin consumir número ni crear evento', async () => {
  const h = harness();
  const first = await h.service.create(fiscal as never, 'empresa', 'request-key-00001');
  const replay = await h.service.create({ ...fiscal, payload_ubl: { ...fiscal.payload_ubl } } as never, 'empresa', 'request-key-00001');
  expect(JSON.stringify(replay)).toBe(JSON.stringify(first));
  expect(h.tx.invoice.create).toHaveBeenCalledTimes(1);
  expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
  expect(h.queue.enqueueInvoiceInTx).toHaveBeenCalledTimes(1);
});
it('misma clave y cuerpo distinto da conflicto, pero otro tenant no colisiona', async () => {
  const h = harness();
  await h.service.create(fiscal as never, 'empresa', 'request-key-00001');
  await expect(h.service.create({ ...fiscal, monto_total: 119 } as never, 'empresa', 'request-key-00001')).rejects.toThrow(ConflictException);
  await h.service.create(fiscal as never, 'otra', 'request-key-00001');
  expect(h.tx.invoice.create).toHaveBeenCalledTimes(2);
});
it('pantalla escribe importes y líneas antes de confirmar la respuesta idempotente', async () => {
  const h = harness();
  const result = await h.service.emitir(pantalla as never, 'empresa', 'request-key-00001');
  expect(result.numero).toBe('F001-00000010');
  expect(h.tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: {
    taxable_operations: 100, total_igv: 18, exempt_operations: 0, unaffected_operations: 0,
  } }));
  expect(h.tx.invoiceItem.createMany.mock.invocationCallOrder[0]).toBeLessThan(h.tx.invoiceCreationRequest.create.mock.invocationCallOrder[0]);
  expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
  await h.service.emitir(pantalla as never, 'empresa', 'request-key-00001');
  expect(h.tx.invoiceItem.createMany).toHaveBeenCalledTimes(1);
});
it('fallo en líneas rechaza la transacción exterior y no registra éxito idempotente', async () => {
  const h = harness();
  h.tx.invoiceItem.createMany.mockRejectedValueOnce(new Error('write failed'));
  await expect(h.service.emitir(pantalla as never, 'empresa', 'request-key-00001')).rejects.toThrow('write failed');
  expect(h.tx.invoiceCreationRequest.create).not.toHaveBeenCalled();
});
it('rechaza RUC ajeno antes de crear y total fiscal distinto antes del commit', async () => {
  const h = harness();
  await expect(h.service.create({ ...fiscal, ruc_emisor: 'otro' } as never, 'empresa', 'request-key-00001')).rejects.toThrow('ISSUER_IDENTITY_MISMATCH');
  expect(h.tx.invoice.create).not.toHaveBeenCalled();
  await expect(h.service.create({ ...fiscal, monto_total: 119 } as never, 'empresa', 'request-key-00002')).rejects.toThrow('total fiscal');
  expect(h.tx.invoiceCreationRequest.create).not.toHaveBeenCalled();
});
it.each(['create', 'emitir'] as const)('ambas rutas bloquean has_credit nulo: %s', async (route) => {
  const h = harness();
  h.tx.businessPartner.findFirst.mockResolvedValue({ has_credit: null, payment_terms: '30_DIAS' } as never);
  const dto = route === 'create' ? { ...fiscal, payload_ubl: { ...fiscal.payload_ubl, formaPago: 'Credito', cuotas: [{ monto: 118, vencimiento: '2026-12-01' }] } } : { ...pantalla, forma_pago: 'Credito', cuotas: [{ monto: 118, vencimiento: '2026-12-01' }] };
  await expect((h.service[route] as any)(dto, 'empresa', 'request-key-00001')).rejects.toThrow('maestro');
  expect(h.queue.enqueueInvoiceInTx).not.toHaveBeenCalled();
});


it.each(['pantalla', 'fiscal'])('sin dato fiscal persistido bloquea %s antes de numerar', async route => {
  const h = harness();
  h.tx.company.findUnique.mockResolvedValue({ ruc: '20100070970', legal_name: 'Empresa' } as never);
  const operation = route === 'pantalla' ? h.service.emitir(pantalla as never, 'empresa', 'request-key-00001') : h.service.create(fiscal as never, 'empresa', 'request-key-00001');
  await expect(operation).rejects.toMatchObject({ response: { code: 'ISSUER_FISCAL_DATA_REQUIRED' } });
  expect(h.tx.$queryRaw).not.toHaveBeenCalled();
  expect(h.tx.invoice.create).not.toHaveBeenCalled();
});
it.each(['pantalla', 'fiscal'])('transporta la configuración persistida en %s hasta XML firmado y SFS', async route => {
  const h = harness();
  if (route === 'pantalla') await h.service.emitir(pantalla as never, 'empresa', 'request-key-00001');
  else await h.service.create(fiscal as never, 'empresa', 'request-key-00001');
  const payload = h.tx.invoice.create.mock.calls[0][0].data.payload_ubl;
  expect(payload).toMatchObject({ codigoLocalAnexoEmisor: '0001', direccionEmisor: fakeFiscalAddress.domicilio_fiscal });
  const { UblGeneratorService } = require('../../../src/modules/invoices/ublGeneratorService');
  const { SignatureService } = require('../../../src/modules/sunat/signature.service');
  const { fakeIssuerCertificate } = require('../../fixtures/fakeIssuerCertificate');
  const { ejecutarSfs } = require('../../../src/modules/invoices/application/services/sunatSfsRunner');
  const certificate = fakeIssuerCertificate('20100070970');
  const xml = new SignatureService({ getCertificate: () => ({ certificatePem: certificate.pem, privateKeyPem: certificate.privateKeyPem }) }).signXml(new UblGeneratorService().generateInvoiceXml(payload)).signedXml;
  expect(await ejecutarSfs(xml, '01')).toEqual({ completado: true, errores: [] });
});

it('congela el almacén no principal tanto en la ruta de pantalla como en la fiscal', async () => {
  for (const ruta of ['pantalla', 'fiscal']) {
    const h = harness();
    if (ruta === 'pantalla') await h.service.emitir({ ...pantalla, almacen: 'ALM-02' } as never, 'empresa', 'warehouse-test-key');
    else await h.service.create({ ...fiscal, payload_ubl: { ...fiscal.payload_ubl, almacen: 'ALM-02' } } as never, 'empresa', 'warehouse-test-key');
    expect(h.tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ payload_ubl: expect.objectContaining({ almacen: 'ALM-02' }) }) }));
    expect(h.tx.inventoryBalance.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ company_id: 'empresa', warehouse: { warehouse_code: 'ALM-02' } }) }));
  }
});

it.each(['pantalla', 'fiscal'])('sin sale_price bloquea %s antes de numerar o persistir', async ruta => {
  const h = harness();
  h.tx.inventoryProduct.findMany.mockResolvedValueOnce([{ sale_price: null, id: 'p1', sku: 'SERV', description: 'Servicio', sunat_unit_code: 'NIU', tax_affectation: '10', is_inventory: false }] as never);
  const trabajo = ruta === 'pantalla' ? h.service.emitir(pantalla as never, 'empresa', 'missing-price-key') : h.service.create(fiscal as never, 'empresa', 'missing-price-key');
  await expect(trabajo).rejects.toThrow('sin precio de venta configurado');
  expect(h.tx.$queryRaw).not.toHaveBeenCalled();
  expect(h.tx.invoice.create).not.toHaveBeenCalled();
  expect(h.queue.enqueueInvoiceInTx).not.toHaveBeenCalled();
});

it('7M publicación null aborta antes de confirmar respuesta/idempotencia', async () => {
 const h = harness(); h.queue.enqueueInvoiceInTx.mockResolvedValueOnce(null as never);
 await expect(h.service.emitir(pantalla as never, 'empresa', 'request-key-null-0001')).rejects.toMatchObject({ response: { code: 'OUTBOX_WRITE_FAILED' } });
 expect(h.tx.invoiceCreationRequest.create).not.toHaveBeenCalled();
 expect(h.tx.invoiceItem.createMany).not.toHaveBeenCalled();
});

it.each(['create', 'emitir'] as const)('pin emisor en %s llega al payload y al RUC persistido sin cambiar la empresa', async route => {
  const h = harness();
  const company = { ruc: '20614142503', issuer_ruc: '20601234567', legal_name: 'Empresa', ...fakeFiscalAddress };
  h.tx.company.findUnique.mockResolvedValue(company as never);
  const dto = { ...fiscal, ruc_emisor: company.issuer_ruc, payload_ubl: { ...fiscal.payload_ubl, rucEmisor: company.issuer_ruc } };
  if (route === 'create') await h.service.create(dto as never, 'empresa', 'pinned-request-0001');
  else await h.service.emitir(pantalla as never, 'empresa', 'pinned-request-0001');
  const data = h.tx.invoice.create.mock.calls[0][0].data;
  expect(data).toMatchObject({ ruc_emisor: company.issuer_ruc, payload_ubl: { rucEmisor: company.issuer_ruc } });
  expect(company.ruc).toBe('20614142503');
});
it('con pin la API rechaza incluso el RUC compartido antes de reservar número o publicar', async () => {
  const h = harness();
  h.tx.company.findUnique.mockResolvedValue({ ruc: fiscal.ruc_emisor, issuer_ruc: '20601234567', ...fakeFiscalAddress } as never);
  await expect(h.service.create(fiscal as never, 'empresa', 'pinned-request-0002')).rejects.toThrow('ISSUER_IDENTITY_MISMATCH');
  expect(h.tx.$queryRaw).not.toHaveBeenCalled();
  expect(h.tx.invoice.create).not.toHaveBeenCalled();
  expect(h.queue.enqueueInvoiceInTx).not.toHaveBeenCalled();
});

it.each(['pantalla','fiscal'])('B8 %s rechaza exceso de bolsas gratuitas antes de reservar o persistir',async ruta=>{
 const h=harness();const dto={...pantalla,fecha_emision:'2026-11-12',items:[{codigo:'SERV',descripcion:'Servicio gratuito',cantidad:1,precioUnitario:0,valorUnitario:35,afectacion:'31',cantidadBolsas:2,icbper:1}]};
 const before=JSON.stringify(dto);
 const request=ruta==='pantalla'?h.service.emitir(dto as never,'empresa','b8-guard-request-key'):h.service.create(traducirEmision(dto as never,{ruc:'20100070970',razonSocial:'Empresa',...fakeFiscalAddress},1).dto,'empresa','b8-guard-request-key');
 await expect(request).rejects.toMatchObject({response:{code:'BOLSAS_GRATUITAS_SUPERAN_CANTIDAD',message:'Las bolsas de una línea gratuita no pueden superar la cantidad de la línea. Ajuste las bolsas o la cantidad.'}});
 expect(h.tx.$queryRaw).not.toHaveBeenCalled();expect(h.tx.invoice.create).not.toHaveBeenCalled();expect(h.queue.enqueueInvoiceInTx).not.toHaveBeenCalled();expect(JSON.stringify(dto)).toBe(before);
});

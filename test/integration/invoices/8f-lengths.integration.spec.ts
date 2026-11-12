import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { AtomicInvoiceCreationService } from '../../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { fakeFiscalAddress } from '../../fixtures/fakeFiscalAddress';
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('8F: longitudes antes de numerar en PostgreSQL aislado', () => {
  let db: PrismaService, company: string;
  const old = process.env.DATABASE_URL;
  const queue = { enqueueInvoiceInTx: jest.fn(async () => 'job') };
  beforeAll(async () => {
    if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Solo PostgreSQL local aislado');
    process.env.DATABASE_URL = url;
    db = new PrismaService(); await db.$connect(); company = randomUUID();
    await db.company.create({ data: { id: company, ruc: '2' + Date.now().toString().slice(-10), legal_name: 'Empresa ficticia', sol_user: 'fake', sol_pass_encrypted: 'fake', ...fakeFiscalAddress } });
    await db.inventoryWarehouse.create({ data: { company_id: company, warehouse_code: 'ALM-01', description: 'Prueba' } });
    await db.inventoryProduct.create({ data: { company_id: company, sku: 'SERV', description: 'Servicio', sale_price: 118, tax_affectation: '10', sunat_unit_code: 'NIU', is_inventory: false } });
    await db.invoiceSeries.create({ data: { company_id: company, document_type: '01', series: 'F001', current_correlative: 69 } });
  });
  afterAll(async () => {
    if (db) {
      await db.invoiceCreationRequest.deleteMany({ where: { company_id: company } });
      await db.invoice.deleteMany({ where: { company_id: company } });
      await db.invoiceSeries.deleteMany({ where: { company_id: company } });
      await db.inventoryProduct.deleteMany({ where: { company_id: company } });
      await db.inventoryWarehouse.deleteMany({ where: { company_id: company } });
      await db.company.delete({ where: { id: company } }); await db.$disconnect();
    }
    if (old === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = old;
  });
  it.each(['pantalla', 'fiscal'])('%s: texto largo no avanza serie ni persiste/publica', async ruta => {
    queue.enqueueInvoiceInTx.mockClear();
    const service = new AtomicInvoiceCreationService(db, queue as never);
    const dto = { tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-12', forma_pago: 'Contado', customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente', items: [{ codigo: 'SERV', descripcion: 'A'.repeat(501), cantidad: 1, precioUnitario: 118, afectacion: '10', unidad: 'NIU' }] };
    const empresa = await db.company.findUniqueOrThrow({ where: { id: company } });
    const work = ruta === 'pantalla' ? service.emitir(dto as never, company, randomUUID()) : service.create(traducirEmision(dto as never,{ruc:empresa.ruc,razonSocial:empresa.legal_name},1).dto as never, company, randomUUID());
    await expect(work).rejects.toThrow('lineas[0].descripcion admite como máximo 500');
    expect((await db.invoiceSeries.findFirstOrThrow({ where: { company_id: company } })).current_correlative).toBe(69);
    expect(await db.invoice.count({ where: { company_id: company } })).toBe(0);
    expect(await db.invoiceCreationRequest.count({ where: { company_id: company } })).toBe(0);
    expect(queue.enqueueInvoiceInTx).not.toHaveBeenCalled();
  });
});

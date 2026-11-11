import { AtomicInvoiceCreationService } from '../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { fakeFiscalAddress } from './fakeFiscalAddress';
const originId = '11111111-1111-4111-8111-111111111111';
export function scenario() {
 const origin = { id: originId, company_id: 'empresa', tipo_comprobante: '01', serie: 'F001', correlativo: 69,
 estado: 'ACEPTADO', monto_total: 118, customer_identity_type: '6', customer_identity_number: '20100070970',
 items: [{ item_code: 'SERV', quantity: 10, unit_code: 'NIU', igv_affectation_type: '10' }] };
 const tx: any = { $executeRaw: jest.fn(async () => 1), $queryRaw: jest.fn(async () => [{ current_correlative: 17 }]),
 inventoryWarehouse: { findFirst: jest.fn(async () => ({ id: 'warehouse' })) },
 inventoryProduct: { findMany: jest.fn(async () => [{ sku: 'SERV', sale_price: 11.8, tax_affectation: '10', sunat_unit_code: 'NIU', is_active: true, is_inventory: true }]) },
 company: { findUnique: jest.fn(async () => ({ ruc: '20100070970', legal_name: 'Emisor de prueba', ...fakeFiscalAddress })) },
 businessPartner: { findFirst: jest.fn(async () => null) },
 invoiceCreationRequest: { findUnique: jest.fn(async () => null), create: jest.fn(async () => ({})) },
 invoice: { findFirst: jest.fn(async () => origin), findMany: jest.fn(async () => []),
 findUniqueOrThrow: jest.fn(async () => ({ id: 'inv-test', estado: 'PENDIENTE', created_at: new Date() })),
 create: jest.fn(async ({ data }) => ({ ...data, id: 'inv-test', estado: 'PENDIENTE', created_at: new Date() })), update: jest.fn(async () => ({})) },
 invoiceItem: { createMany: jest.fn(async () => ({ count: 1 })) }, transactionHistory: { create: jest.fn(async () => ({})) } };
 const queue = { enqueueInvoiceInTx: jest.fn(async () => 'trabajo-simulado') };
 const service = new AtomicInvoiceCreationService({ $transaction: async (f: any) => f(tx) } as never, queue as never);
 return { tx, queue, service };
}

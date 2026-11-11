import { prepareCreation, fiscalToEmission } from '../../src/modules/invoices/application/services/creationGuards';
import { traducirEmision } from '../../src/modules/invoices/application/services/emitirComprobanteAdapter';
export const base = () => ({ tipo_comprobante: '01', serie: 'F001', customer_legal_name: 'Cliente',
  customer_identity_type: '6', customer_identity_number: '20100070970', forma_pago: 'Contado', fecha_emision: '2026-11-07',
  items: [{ codigo: 'SERV', descripcion: 'Servicio', precioUnitario: 118, cantidad: 1 }] });
export function harness() {
  const product = { sale_price: 118, sku: 'SERV', tax_affectation: '10', sunat_unit_code: 'NIU' };
  const origin = { id: 'origin', tipo_comprobante: '01', serie: 'F001', correlativo: 1, estado: 'ACEPTADO',
    items: [{ item_code: 'SERV', quantity: 1, unit_code: 'NIU', igv_affectation_type: '10' }], monto_total: 118, customer_identity_type: '6', customer_identity_number: '20100070970' };
  const tx = { inventoryWarehouse: { findFirst: jest.fn(async () => ({ id: 'warehouse' })) }, inventoryProduct: { findMany: jest.fn(async () => [product]) },
    businessPartner: { findFirst: jest.fn(async () => ({ id: 'cli', has_credit: true, allows_discount: true })) },
    partnerTaxStatus: { findFirst: jest.fn(async () => null) }, $executeRaw: jest.fn(async () => 1),
    invoice: { findFirst: jest.fn(async () => origin), findMany: jest.fn(async () => [] as any[]) } };
  return { product, origin, tx, run: (dto: any = base()) => prepareCreation(tx as never, dto, 'empresa') };
}


export function entradaNota(d: any, ruta: string) { return ruta === 'pantalla' ? d : fiscalToEmission(traducirEmision({ ...d, items: d.items.map((l: any) => ({ ...l, afectacion: l.afectacion ?? '10', unidad: l.unidad ?? 'NIU' })) }, { ruc: '20000000001', razonSocial: 'Prueba' }, 1).dto); }
export const nota = () => ({ ...base(), tipo_comprobante: '07', serie: 'FC01', documento_afectado: 'F001-00000001', codigo_motivo_nota: '06' });

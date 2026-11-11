import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';
import { aComprobanteDemo } from '@/modules/invoices/lib/invoiceApiMapper';
import { InvoiceCdrModal } from '@/modules/invoices/components/InvoiceCdrModal';
import { InvoiceKpiCards } from '@/modules/invoices/components/InvoiceKpiCards';
import { calcularResumenFiscal } from '@/modules/invoices/lib/invoiceMetrics';
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi:{ getInvoiceById: vi.fn(async () => { throw Error('Sin detalle'); }) } }));
vi.mock('@/modules/invoices/lib/invoiceDescarga', () => ({ obtenerXmlDesdeBackend: vi.fn(async () => null), extraerDigestValue: vi.fn(() => null), descargarDesdeBackend: vi.fn() }));
afterEach(cleanup);
function fila(origen: 'SUNAT' | 'VALIDACION_LOCAL' | 'NO_DETERMINADO') {
 return aComprobanteDemo(aInvoice({ id:origen,tipo_comprobante:'03',serie:'B001',correlativo:5,numero:'B001-00000005',fecha_emision:'2026-11-10',estado:'RECHAZADO',monto_total:17.7,moneda:'PEN',cliente_documento:'12345678',cliente_nombre:'Cliente',cdr_codigo:null, resultado_presentacion:{ origen,codigo:'3128',motivo:'Motivo persistido' } }));
}
it('contador separa tres orígenes sin alterar estados ni total de rechazados', () => {
 const rows = [fila('SUNAT'), fila('VALIDACION_LOCAL'), fila('NO_DETERMINADO')]; const resumen=calcularResumenFiscal(rows);
 expect(resumen).toMatchObject({ rechazados:3,rechazosSunat:1,bloqueadosLocalmente:1,rechazosSinOrigen:1 });
 render(<InvoiceKpiCards resumen={resumen} />);
 expect(screen.getByText(/Rechazos SUNAT: 1 · Bloqueados localmente: 1 · Origen no confirmado: 1/)).toBeTruthy();
 expect(rows.every(c=>c.estado==='RECHAZADO')).toBe(true);
});
it.each(['VALIDACION_LOCAL','NO_DETERMINADO'] as const)('bloque crudo no atribuye respuesta a SUNAT para %s', async origen => {
 const c=fila(origen); render(<InvoiceCdrModal comprobante={c} onCerrar={()=>{}} />);
 expect(screen.queryByText('Respuesta oficial CDR SUNAT (billService)')).toBeNull();
 expect(screen.getAllByText(origen==='VALIDACION_LOCAL'?'Bloqueado por validación local':'Rechazado (origen no confirmado)').length).toBeGreaterThan(0);
 expect(screen.getAllByText('Motivo persistido').length).toBeGreaterThan(0);
});
it('rechazo real conserva la atribución y el mensaje recibido sin editarlo', () => {
 const c={ ...fila('SUNAT'),cdrCodigo:'2335',cdrDescripcion:'Respuesta literal SUNAT' };
 render(<InvoiceCdrModal comprobante={c} onCerrar={()=>{}} />);
 expect(screen.getByText('Respuesta oficial CDR SUNAT (billService)')).toBeTruthy(); expect(c.cdrDescripcion).toBe('Respuesta literal SUNAT');
});

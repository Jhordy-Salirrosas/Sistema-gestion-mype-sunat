import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import InvoiceMonitorPage from '@/modules/invoices/pages/InvoiceMonitorPage';
import { InvoiceStatusBadge } from '@/modules/invoices/components/InvoiceStatusBadge';
import { InvoiceAuditTrail } from '@/modules/invoices/components/InvoiceAuditTrail';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';
import { aComprobanteDemo } from '@/modules/invoices/lib/invoiceApiMapper';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { ALERTAS_VACIAS } from '@/modules/invoices/lib/invoiceAlertas';
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{getAgregados:vi.fn(),getAlertas:vi.fn(),getInvoices:vi.fn(),getInvoiceById:vi.fn(),reprocesarPuente:vi.fn()}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const raw={id:'p',tipo_comprobante:'01',serie:'F001',correlativo:1,numero:'F001-00000001',fecha_emision:'2026-11-11',estado:'ACEPTADO',monto_total:118,moneda:'PEN',cliente_documento:'20100070970',cliente_nombre:'Cliente',cdr_codigo:'0',cdr_descripcion:'Aceptado por SUNAT',resultado_presentacion:{origen:'BRIDGE_PENDING' as const,codigo:'M1_BRIDGE_INVENTORY_OMITTED',motivo:'ACEPTADO con puente pendiente: descarga omitida.'}};
it('detalle conserva el resultado fiscal y muestra la causa local sin inventar rechazo',()=>{
 const c=aComprobanteDemo(aInvoice(raw));render(<><InvoiceStatusBadge estado={c.estado} resultado={c.resultadoPresentacion}/><InvoiceAuditTrail comprobante={c} digest={null}/></>);
 expect(screen.getByLabelText('Puente local pendiente')).toBeTruthy();expect(screen.getByText(raw.resultado_presentacion.motivo)).toBeTruthy();expect(screen.getAllByText('ACEPTADO').length).toBeGreaterThan(0);
 expect(screen.queryByText(/Incertidumbre de transporte|Rechazado por SUNAT/)).toBeNull();
});
it('Monitor consulta solo puentes pendientes, muestra causa y usa reprocesar-puente',async()=>{
 const invoice=aInvoice(raw);vi.mocked(invoicesApi.getAgregados).mockResolvedValue([]);vi.mocked(invoicesApi.getAlertas).mockResolvedValue(ALERTAS_VACIAS);
 vi.mocked(invoicesApi.getInvoices).mockImplementation(async(_page,filters)=>({data:filters?.puente_pendiente==='true'?[invoice]:[],total:1,page:1,pageSize:100,totalPages:1}));
 vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue({...invoice,historial:[]} as never);
 vi.mocked(invoicesApi.reprocesarPuente).mockResolvedValue({completo:false,errores:['Descarga omitida por servicio.']} as never);
 render(<InvoiceMonitorPage/>);const button=await screen.findByRole('button',{name:'Reprocesar puente'});
 expect(screen.getByText('ACEPTADO con puente pendiente')).toBeTruthy();fireEvent.click(button);
 expect(await screen.findByText('Puente pendiente: Descarga omitida por servicio.')).toBeTruthy();expect(invoicesApi.reprocesarPuente).toHaveBeenCalledWith('p');
});

import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mensajeErrorEmision } from '@/modules/invoices/lib/invoiceIdempotency';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { apiClient } from '@/lib/axios';
import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const qs: QueryClient[]=[];
afterEach(()=>{cleanup();qs.forEach(q=>q.clear());qs.length=0;vi.resetAllMocks();});
it('400 conserva detail/message del back y evita el texto técnico de Axios',()=>{
 for(const data of [{detail:'NOTA_DEVOLUCION_TOTAL_INCOMPLETA: faltan unidades'},{message:'NOTA_DEVOLUCION_TOTAL_INCOMPLETA: faltan unidades'}]) {
  const error=Object.assign(new Error('Request failed with status code 400'),{response:{status:400,data}});
  expect(mensajeErrorEmision(error)).toContain('NOTA_DEVOLUCION_TOTAL_INCOMPLETA');
  expect(mensajeErrorEmision(error)).not.toContain('Request failed');
 }
});
it('el texto de reutilización de clave solo corresponde al conflicto concreto de idempotencia',()=>{
 for(const data of [{detail:'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY'},{code:'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY'}]) {
  expect(mensajeErrorEmision({response:{status:409,data}})).toContain('la clave de este intento ya se usó');
 }
});
it('otros 409 conservan su causa; un 409 sin detalle no afirma reutilización de clave',()=>{
 expect(mensajeErrorEmision({response:{status:409,data:{detail:'NOTA_EXCEDE_CANTIDAD: CEM-001'}}})).toBe('NOTA_EXCEDE_CANTIDAD: CEM-001');
 expect(mensajeErrorEmision({response:{status:409}})).toContain('Conflicto de emisión (409)');
 expect(mensajeErrorEmision({response:{status:409}})).not.toContain('clave');
 expect(mensajeErrorEmision(new Error('Conexión interrumpida'))).toBe('Conexión interrumpida');
 expect(mensajeErrorEmision(null)).not.toBe('Error desconocido');
});
it('nota 400 muestra el motivo del servidor, conserva edición y la misma clave al reintentar',async()=>{
 const factura=construir({tipo:'01',serie:'F001',correlativo:69,ruc:'20100070970',razonSocial:'Cliente',fecha:'2026-11-11',base:100,estado:'ACEPTADO'});
 const saldo={total:118,devuelto:0,disponible:118,motivos_totales: ['01', '02', '06'], cantidades_pendientes:[{codigo:'CEM-001',original:1,pendiente:1}]};
 const detalle={id:factura.id,tipo_comprobante:'01',serie:'F001',correlativo:69,numero:'F001-00000069',fecha_emision:'2026-11-11',estado:'ACEPTADO',monto_total:118,moneda:'PEN',cliente_documento:'20100070970',cliente_nombre:'Cliente',cdr_codigo:'0',lineas_origen:[{codigo:'CEM-001',descripcion:'Cemento real',unidad:'NIU',cantidad:1,valor_unitario:100,precio_unitario:118,afectacion:'10'}]};
 vi.mocked(apiClient.get).mockImplementation(async url=>({data:String(url).endsWith('/saldo')?saldo:String(url).includes(`/invoices/${factura.id}`)?detalle:[]}) as never);
 const error=Object.assign(new Error('Request failed with status code 400'),{response:{status:400,data:{detail:'NOTA_DEVOLUCION_TOTAL_INCOMPLETA: debe devolver todas las unidades pendientes de CEM-001'}}});
 vi.mocked(apiClient.post).mockRejectedValue(error);
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});qs.push(q);const onEmitir=vi.fn();
 render(<QueryClientProvider client={q}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial="07" fecha="2026-11-11" existentes={[factura]} onEmitir={onEmitir} onCerrar={vi.fn()} /></QueryClientProvider>);
 fireEvent.change(screen.getByLabelText('Documento afectado'),{target:{value:'F001-00000069'}});
 await waitFor(()=>expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('Cemento real'));
 fireEvent.change(screen.getByLabelText('Motivo de la nota'),{target:{value:'06'}});
 // La cantidad local está completa; el 400 puede surgir por un cambio concurrente posterior al refresco.
 fireEvent.change(screen.getByLabelText('Descripción de la línea 1'),{target:{value:'Cemento editado'}});
 const boton=screen.getByRole('button',{name:'Emitir Nota de Crédito'}) as HTMLButtonElement;
 await waitFor(()=>expect(boton.disabled).toBe(false));fireEvent.click(boton);
 expect(await screen.findByText(/No se pudo emitir el comprobante: NOTA_DEVOLUCION_TOTAL_INCOMPLETA/)).toBeTruthy();
 expect(screen.queryByText(/Request failed with status code/)).toBeNull();expect(onEmitir).not.toHaveBeenCalled();
 expect((screen.getByLabelText('Cantidad de la línea 1') as HTMLInputElement).value).toBe('1');
 expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('Cemento editado');
 const primero=vi.mocked(apiClient.post).mock.calls[0];
 await waitFor(()=>expect(boton.disabled).toBe(false));fireEvent.click(boton);
 await waitFor(()=>expect(apiClient.post).toHaveBeenCalledTimes(2));
 expect(vi.mocked(apiClient.post).mock.calls[1]).toEqual(primero);
});

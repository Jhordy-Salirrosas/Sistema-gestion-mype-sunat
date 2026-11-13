import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
import { InvoiceBatchRetry } from '@/modules/invoices/components/InvoiceBatchRetry';
import InvoiceMonitorPage from '@/modules/invoices/pages/InvoiceMonitorPage';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { ALERTAS_VACIAS } from '@/modules/invoices/lib/invoiceAlertas';
import type { ReintentoMasivo } from '@/modules/invoices/services/invoiceBatchRetryApi';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(),post:vi.fn()}}));
vi.mock('@/modules/invoices/components/InvoiceRvieSection',()=>({InvoiceRvieSection:()=>null}));
const previa:ReintentoMasivo={fase:'PREVIA',elegibles:2,encolados:0,omitidos_incertidumbre:1,omitidos_rechazo_definitivo:1,omitidos_bloqueo_local:1,en_curso:0,ya_en_cola:0,omitidos_estado:0,no_confirmados:0,documentos:[
 {id:'e1',numero:'F001-00000090',estado:'ERROR_RED',resultado:'ELEGIBLE',motivo:'Reintento mediante la compuerta individual; no fuerza envío ni firma.'},
 {id:'e2',numero:'F001-00000091',estado:'EN_COLA',resultado:'ELEGIBLE',motivo:'Reintento mediante la compuerta individual; no fuerza envío ni firma.'},
 {id:'u',numero:'F001-00000052',estado:'ERROR_RED',resultado:'OMITIDO_INCERTIDUMBRE',motivo:'Incertidumbre de transporte: consultar SUNAT; no reenviar.'},
 {id:'r',numero:'F001-00000079',estado:'RECHAZADO',resultado:'OMITIDO_RECHAZO_DEFINITIVO',motivo:'Rechazo definitivo de SUNAT: no se reabre ni se reenvía.'},
 {id:'l',numero:'F001-00000083',estado:'ERROR_RED',resultado:'OMITIDO_BLOQUEO_LOCAL',motivo:'Bloqueo local: corregir los datos o verificar la causa antes de reintentar.'},
]};
const resultado:ReintentoMasivo={...previa,fase:'EJECUTADA',elegibles:0,encolados:1,ya_en_cola:1,documentos:previa.documentos.map((d,i)=>i===0?{...d,resultado:'ENCOLADO',motivo:'Comprobante reencolado mediante la compuerta individual.'}:i===1?{...d,resultado:'YA_EN_COLA',motivo:'Ya existe un trabajo activo; no se duplicó.'}:d)};
beforeEach(()=>{
 useAuthStore.setState({user:{id:'admin',email:'local@test',role:'ADMIN'}});
 vi.mocked(apiClient.get).mockResolvedValue({data:previa});vi.mocked(apiClient.post).mockResolvedValue({data:resultado});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.resetAllMocks();useAuthStore.setState({user:null});});
it.each(['AUDITOR','OPERADOR_FACTURACION','CONTADOR'] as const)('%s no tiene acción masiva ni solicitudes implícitas',role=>{
 useAuthStore.setState({user:{id:'local',email:'local@test',role}});render(<InvoiceBatchRetry onComplete={vi.fn()} />);
 expect(screen.queryByRole('button')).toBeNull();expect(apiClient.get).not.toHaveBeenCalled();expect(apiClient.post).not.toHaveBeenCalled();
});
it('el Monitor real muestra vista previa de la API, confirma y conserva los conteos reales tras actualizar',async()=>{
 vi.spyOn(invoicesApi,'getAgregados').mockResolvedValue([]);const alertas=vi.spyOn(invoicesApi,'getAlertas').mockResolvedValue(ALERTAS_VACIAS);
 vi.spyOn(invoicesApi,'getInvoices').mockResolvedValue({data:[],total:0,page:1,pageSize:100,totalPages:1});
 render(<InvoiceMonitorPage />);const user=userEvent.setup();await screen.findByText('Monitor Outbox y Auditoría CDR');
 expect(apiClient.get).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Reenviar encolados'}));
 const dialog=await screen.findByRole('dialog',{name:'Confirmar reenvío masivo'});
 await within(dialog).findByText('Elegibles para intentar: 2');expect(within(dialog).getByText('Omitidos por incertidumbre: 1')).toBeTruthy();
 expect(within(dialog).getByText('Omitidos por rechazo definitivo de SUNAT: 1')).toBeTruthy();expect(within(dialog).getByText('Omitidos por bloqueo local: 1')).toBeTruthy();
 expect(apiClient.get).toHaveBeenCalledWith('/invoices/retry-batch');expect(apiClient.post).not.toHaveBeenCalled();
 await user.click(within(dialog).getByText('Detalle por comprobante'));expect(within(dialog).getByText('F001-00000052')).toBeVisible();
 await user.click(within(dialog).getByRole('button',{name:'Confirmar reenvío'}));
 await screen.findByText('Resultado del reenvío masivo');expect(screen.getByText('Encolados: 1')).toBeTruthy();expect(screen.getByText('Ya en cola: 1')).toBeTruthy();
 expect(apiClient.post).toHaveBeenCalledWith('/invoices/retry-batch',undefined,{timeout:120000});
 await waitFor(()=>expect(alertas.mock.calls.length).toBeGreaterThan(1));
 await user.click(screen.getByRole('button',{name:'Actualizar'}));expect(screen.getByText('Encolados: 1')).toBeTruthy();
});
it('cancelar no publica y un lote sin elegibles no permite confirmar',async()=>{
 render(<InvoiceBatchRetry onComplete={vi.fn()} />);const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'Reenviar encolados'}));await screen.findByText('Elegibles para intentar: 2');
 await user.click(screen.getByRole('button',{name:'Cancelar'}));expect(apiClient.post).not.toHaveBeenCalled();
 vi.mocked(apiClient.get).mockResolvedValueOnce({data:{...previa,elegibles:0,documentos:[]}});
 await user.click(screen.getByRole('button',{name:'Reenviar encolados'}));await screen.findByText('Elegibles para intentar: 0');
 expect(screen.getByRole('button',{name:'Confirmar reenvío'})).toBeDisabled();
});
it('error de vista previa deja aviso sin publicar; se puede volver a consultar',async()=>{
 vi.mocked(apiClient.get).mockRejectedValueOnce({});render(<InvoiceBatchRetry onComplete={vi.fn()} />);const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'Reenviar encolados'}));expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo obtener la vista previa.');
 expect(screen.getByRole('button',{name:'Confirmar reenvío'})).toBeDisabled();expect(apiClient.post).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Cancelar'}));await user.click(screen.getByRole('button',{name:'Reenviar encolados'}));await screen.findByText('Elegibles para intentar: 2');
});
it('fallo de ejecución informa incertidumbre del resultado y permite revisar el Monitor',async()=>{
 vi.mocked(apiClient.post).mockRejectedValueOnce({});const complete=vi.fn();render(<InvoiceBatchRetry onComplete={complete} />);const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'Reenviar encolados'}));await screen.findByText('Elegibles para intentar: 2');await user.click(screen.getByRole('button',{name:'Confirmar reenvío'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar el reenvío. Actualice el Monitor antes de repetir.');expect(complete).not.toHaveBeenCalled();
});
it('dos clics inmediatos comparten una sola consulta y una sola ejecución, con resultado no confirmado visible',async()=>{
 let cargar!:(r:unknown)=>void;let enviar!:(r:unknown)=>void;
 vi.mocked(apiClient.get).mockImplementationOnce(()=>new Promise(resolve=>{cargar=resolve;}));
 vi.mocked(apiClient.post).mockImplementationOnce(()=>new Promise(resolve=>{enviar=resolve;}));
 const complete=vi.fn();render(<InvoiceBatchRetry onComplete={complete} />);
 const b=screen.getByRole('button',{name:'Reenviar encolados'});
 act(()=>{b.click();b.click();});expect(apiClient.get).toHaveBeenCalledTimes(1);expect(screen.getByRole('status')).toBeTruthy();
 await act(async()=>{cargar({data:previa});});
 const confirmar=screen.getByRole('button',{name:'Confirmar reenvío'});act(()=>{confirmar.click();confirmar.click();});
 expect(apiClient.post).toHaveBeenCalledTimes(1);
 await act(async()=>{enviar({data:{...resultado,encolados:0,no_confirmados:1,en_curso:1}});});
 expect(await screen.findByText('No confirmados: 1')).toBeTruthy();expect(screen.getByText('En curso en otro lote: 1')).toBeTruthy();expect(complete).toHaveBeenCalledTimes(1);
});

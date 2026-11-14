import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useInvoiceDetailRefresh } from '@/modules/invoices/hooks/useInvoiceDetailRefresh';
import { notifyInvoiceQueued } from '@/modules/invoices/lib/invoiceQueueEvents';
const get=vi.hoisted(()=>vi.fn());
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{getInvoiceById:get}}));
beforeEach(()=>{vi.useFakeTimers();get.mockReset();get.mockResolvedValue({id:'i',estadoBackend:'EN_COLA'});});
afterEach(()=>{cleanup();vi.useRealTimers();});
it('lee una vez al abrir y deja de sondear al aceptar',async()=>{
 const h=renderHook(()=>useInvoiceDetailRefresh('i'));await act(async()=>{});expect(get).toHaveBeenCalledTimes(1);
 get.mockResolvedValueOnce({id:'i',estadoBackend:'EN_COLA'}).mockResolvedValueOnce({id:'i',estadoBackend:'ACEPTADO',cdrCodigo:'0'});
 await act(async()=>notifyInvoiceQueued('i'));await act(async()=>{await vi.advanceTimersByTimeAsync(1500);});
 expect(h.result.current?.detail?.estadoBackend).toBe('ACEPTADO');const count=get.mock.calls.length;
 await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});expect(get).toHaveBeenCalledTimes(count);
});
it('limita a doce lecturas incluso ante errores y no sondea otro comprobante',async()=>{
 renderHook(()=>useInvoiceDetailRefresh('i'));await act(async()=>{});
 await act(async()=>notifyInvoiceQueued('otro'));expect(get).toHaveBeenCalledTimes(1);
 get.mockRejectedValue(new Error('sin red'));await act(async()=>notifyInvoiceQueued('i'));
 await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});expect(get).toHaveBeenCalledTimes(13);
});
it('cancela temporizador y descarta respuestas tardías al cerrar o cambiar id',async()=>{
 const h=renderHook(({id})=>useInvoiceDetailRefresh(id),{initialProps:{id:'i' as string|null}});await act(async()=>{});
 await act(async()=>notifyInvoiceQueued('i'));h.rerender({id:null});await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
 expect(h.result.current).toBeUndefined();expect(get).toHaveBeenCalledTimes(2);h.unmount();
});

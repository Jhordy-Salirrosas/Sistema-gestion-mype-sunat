import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readLocalDraft, useInvoiceLocalDraft } from '@/modules/invoices/hooks/useInvoiceLocalDraft';
beforeEach(()=>{localStorage.clear();vi.useFakeTimers();});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();localStorage.clear();});
it('autoguarda, recupera y descarta sin añadir campos al dato del formulario',async()=>{
 const {result,rerender,unmount}=renderHook(({nombre})=>useInvoiceLocalDraft('m1:emision:empresa:usuario',{nombre}),{initialProps:{nombre:''}});
 await act(async()=>{});act(()=>result.current.marcar());rerender({nombre:'Cliente'});
 await act(async()=>{await vi.advanceTimersByTimeAsync(700);});
 expect(readLocalDraft<{nombre:string}>('m1:emision:empresa:usuario')?.data).toEqual({nombre:'Cliente'});expect(result.current.savedAt).toBeTruthy();
 unmount();const nuevo=renderHook(()=>useInvoiceLocalDraft('m1:emision:empresa:usuario',{nombre:''}));
 await act(async()=>{});expect(nuevo.result.current.disponible?.data).toEqual({nombre:'Cliente'});
 act(()=>nuevo.result.current.descartar());nuevo.unmount();expect(localStorage.getItem('m1:emision:empresa:usuario')).toBeNull();
});
it('salir antes de terminar el debounce conserva el último dato',async()=>{
 const {result,rerender,unmount}=renderHook(({nombre})=>useInvoiceLocalDraft('local',{nombre}),{initialProps:{nombre:''}});await act(async()=>{});
 act(()=>result.current.marcar());rerender({nombre:'Último valor'});unmount();expect(readLocalDraft<{nombre:string}>('local')?.data.nombre).toBe('Último valor');
});
it('separa usuarios y empresas sin trasladar el borrador previo',async()=>{
 localStorage.setItem('a:u',JSON.stringify({version:1,savedAt:'2026-11-19T12:00:00Z',data:{nombre:'Privado'}}));
 const {result,rerender}=renderHook(({key})=>useInvoiceLocalDraft(key,{nombre:''}),{initialProps:{key:'a:u'}});await act(async()=>{});
 expect(result.current.disponible?.data.nombre).toBe('Privado');rerender({key:'b:v'});await act(async()=>{});expect(result.current.disponible).toBeNull();
});
it('sin almacenamiento disponible no anuncia un guardado falso',async()=>{
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('storage');});
 const {result}=renderHook(()=>useInvoiceLocalDraft('local',{nombre:'Cliente'}));await act(async()=>{});act(()=>result.current.marcar());await act(async()=>{await vi.advanceTimersByTimeAsync(700);});expect(result.current.savedAt).toBeNull();
});
it('un archivo local inválido no rompe la apertura del formulario',()=>{
 localStorage.setItem('local','{roto');expect(readLocalDraft('local')).toBeNull();expect(readLocalDraft(null)).toBeNull();
});

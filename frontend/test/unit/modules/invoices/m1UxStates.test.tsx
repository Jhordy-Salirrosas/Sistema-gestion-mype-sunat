import { InvoiceWait } from '@/modules/invoices/components/InvoiceWait';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { InvoiceStatusBadge } from '@/modules/invoices/components/InvoiceStatusBadge';
import { ETIQUETAS_BANDEJA } from '@/modules/invoices/lib/invoiceBandejaState';
import { InvoiceIssueGuidance } from '@/modules/invoices/components/InvoiceIssueGuidance';
import { orientacionError } from '@/modules/invoices/lib/invoiceErrorGuidance';
import { InvoicePriorityNotice } from '@/modules/invoices/components/InvoicePriorityNotice';
afterEach(()=>{cleanup();vi.useRealTimers();});
it.each(Object.entries(ETIQUETAS_BANDEJA))('estado %s usa texto, icono y color sin ser acción', (estado,label)=>{
 const resultado=estado==='RECHAZADO'?{origen:'SUNAT' as const,codigo:'x',motivo:'Motivo real'}:estado==='PREPARACION_LOCAL'?{origen:'PREPARACION_LOCAL' as const,codigo:'local',motivo:'Motivo real'}:estado==='NO_DETERMINADO'?{origen:'NO_DETERMINADO' as const,codigo:'x',motivo:'Motivo real'}:undefined;
 render(<InvoiceStatusBadge estado={estado==='NO_DETERMINADO'?'RECHAZADO':estado} estadoBackend={estado==='NO_DETERMINADO'?'RECHAZADO':estado} resultado={resultado}/>);
 const badge=screen.getByLabelText(label);expect(badge).toHaveTextContent(label);expect(badge.querySelector('svg[aria-hidden=true]')).toBeTruthy();expect(badge.className).toContain('bg-');expect(screen.queryByRole('button')).toBeNull();expect(screen.queryByRole('link')).toBeNull();
});
it('aceptada con observación es distinguible de aceptada',()=>{
 render(<><InvoiceStatusBadge estado="ACEPTADO"/><InvoiceStatusBadge estado="OBSERVADO"/></>);
 expect(screen.getByLabelText('Aceptada')).toBeVisible();expect(screen.getByLabelText('Aceptada con observación')).toBeVisible();
});
it('un código desconocido no adquiere un significado inventado',()=>{
 expect(orientacionError('999999').mensaje).toBe('El comprobante requiere revisión.');
 render(<InvoiceIssueGuidance codigo="999999" motivo="Texto literal del servidor"/>);
 expect(screen.getByText('Motivo informado: Texto literal del servidor')).toBeVisible();expect(screen.getByText('Ver detalle técnico')).toBeVisible();
 expect(screen.queryByText(/RUC incorrecto/)).toBeNull();
});
it.each(['2108','2957','3319','3267'])('traduce el código %s ya documentado en M1',codigo=>{
 expect(orientacionError(codigo).accion).toMatch(/Revise/);
});
it('solo el aviso de mayor prioridad se presenta como banner',()=>{
 render(<InvoicePriorityNotice notices={[{priority:30,title:'Información',text:'Consulta disponible'},{priority:100,title:'Rechazada',text:'Revise el motivo'}]}/>);
 const banner=screen.getByRole('alert',{name:'Aviso prioritario'});expect(within(banner).getByRole('heading')).toHaveTextContent('Rechazada');expect(screen.getAllByRole('alert')).toHaveLength(1);expect(screen.getByText('Otros avisos (1)')).toBeVisible();
});

it('espera sin indicador inicial, muestra el módulo tras 2 s y texto tras 10 s',()=>{
 vi.useFakeTimers();render(<InvoiceWait label="Cargando comprobantes…" skeleton/>);expect(screen.queryByRole('status')).toBeNull();act(()=>vi.advanceTimersByTime(1999));expect(screen.queryByRole('status')).toBeNull();act(()=>vi.advanceTimersByTime(1));expect(screen.getByRole('status')).toHaveTextContent('Cargando comprobantes…');act(()=>vi.advanceTimersByTime(8000));expect(screen.getByRole('status')).toHaveTextContent('La consulta sigue en curso');expect(screen.queryByRole('progressbar')).toBeNull();
});

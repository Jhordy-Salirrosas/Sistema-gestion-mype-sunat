import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EnviarBajaPanel } from '@/modules/invoices/components/EnviarBajaPanel';
import { InvoiceAggregateMonitor } from '@/modules/invoices/components/InvoiceAggregateMonitor';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import type { VistaPreviaResumen } from '@/modules/invoices/lib/invoiceResumenes';
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { previsualizarBaja: vi.fn(), enviarBaja: vi.fn(), getAgregados: vi.fn(), consultarAgregado: vi.fn() } }));
const vista: VistaPreviaResumen = { envio: { identificador: 'RA-20261109-001', tipo: 'COMUNICACION_BAJA', fechaReferencia: '2026-11-09', correlativo: 1, lineas: 1 }, errores: [], xml: '<VoidedDocuments/>', lineas: [
  { id: 'i', serie: 'F001', correlativo: 62, tipoComprobante: '01', fechaEmision: '2026-11-09', estado: 'ACEPTADO', incluido: true, total: 118, dias: 0, motivoExclusion: '' },
  { id: 'nc', serie: 'F001', correlativo: 61, tipoComprobante: '01', fechaEmision: '2026-11-09', estado: 'ACEPTADO', incluido: false, total: 118, dias: 0, motivoExclusion: 'Neutralizado por nota de crédito de saldo completo.' },
] };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('sin selección explícita no permite preview ni envío; la neutralizada queda deshabilitada', () => {
  render(<EnviarBajaPanel fecha="2026-11-09" vista={vista} onEnviado={vi.fn()} />);
  expect((screen.getByRole('button', { name: 'Enviar baja a SUNAT' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('Dar de baja F001-61') as HTMLInputElement).disabled).toBe(true);
  expect(invoicesApi.enviarBaja).not.toHaveBeenCalled();
});
it('selección y motivo se previsualizan y envían solo tras confirmación', async () => {
  vi.mocked(invoicesApi.previsualizarBaja).mockResolvedValue(vista);
  vi.mocked(invoicesApi.enviarBaja).mockResolvedValue({ enviado: true, identificador: 'RA-20261109-002', jobId: 'job', incluidos: 1, motivo: null });
  const refresh = vi.fn(); render(<EnviarBajaPanel fecha="2026-11-09" vista={vista} onEnviado={refresh} />);
  fireEvent.click(screen.getByLabelText('Dar de baja F001-62'));
  fireEvent.change(screen.getByLabelText('Motivo de baja F001-62'), { target: { value: 'Error de operación' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ver XML de selección' }));
  expect(await screen.findByText('XML de los documentos seleccionados')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar baja a SUNAT' })); expect(invoicesApi.enviarBaja).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja en SUNAT' }));
  expect((await screen.findByRole('status')).textContent).toContain('RA-20261109-002');
  expect(invoicesApi.enviarBaja).toHaveBeenCalledExactlyOnceWith('2026-11-09', [{ id: 'i', motivo: 'Error de operación' }]); expect(refresh).toHaveBeenCalledTimes(1); expect((screen.getByRole('button', { name: 'Enviar baja a SUNAT' }) as HTMLButtonElement).disabled).toBe(true);
});
it('editar el motivo invalida el XML previo y obliga a actualizarlo', async () => {
  vi.mocked(invoicesApi.previsualizarBaja).mockResolvedValue(vista); render(<EnviarBajaPanel fecha="2026-11-09" vista={vista} onEnviado={vi.fn()} />);
  fireEvent.click(screen.getByLabelText('Dar de baja F001-62')); fireEvent.click(screen.getByRole('button', { name: 'Ver XML de selección' })); await screen.findByText('XML de los documentos seleccionados');
  fireEvent.change(screen.getByLabelText('Motivo de baja F001-62'), { target: { value: 'Otro motivo' } });
  expect(screen.queryByText('XML de los documentos seleccionados')).toBeNull(); expect((screen.getByRole('button', { name: 'Enviar baja a SUNAT' }) as HTMLButtonElement).disabled).toBe(true);
});
it('presenta motivo de rechazo a la preparación sin afirmar aceptación', async () => {
  vi.mocked(invoicesApi.previsualizarBaja).mockResolvedValue(vista); vi.mocked(invoicesApi.enviarBaja).mockResolvedValue({ enviado: false, identificador: 'RA-20261109-001', jobId: null, incluidos: 1, motivo: 'Validación XSD bloqueada' });
  render(<EnviarBajaPanel fecha="2026-11-09" vista={vista} onEnviado={vi.fn()} />); fireEvent.click(screen.getByLabelText('Dar de baja F001-62')); fireEvent.click(screen.getByRole('button', { name: 'Ver XML de selección' })); await screen.findByText('XML de los documentos seleccionados'); fireEvent.click(screen.getByRole('button', { name: 'Enviar baja a SUNAT' })); fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja en SUNAT' }));
  expect((await screen.findByRole('status')).textContent).toContain('Validación XSD bloqueada');
});
it.each(['RA', 'RC'] as const)('Monitor muestra %s, ticket, causa y consulta sin reenvío', async kind => {
  vi.mocked(invoicesApi.getAgregados).mockResolvedValue([{ id: 'a', kind, identifier: `${kind}-20261109-001`, reference_date: '2026-11-09', state: 'POLLING', ticket: 'T-FAKE', transport_uncertain: false, result: null, error: 'SUNAT sigue procesando' }]);
  vi.mocked(invoicesApi.consultarAgregado).mockResolvedValue({ motivo: 'En proceso', status: '98' }); render(<InvoiceAggregateMonitor />);
  expect(await screen.findByText(/Ticket: T-FAKE/)).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: `Consultar ticket ${kind}-20261109-001` }));
  expect((await screen.findByText('En proceso')).textContent).toContain('En proceso'); expect(invoicesApi.consultarAgregado).toHaveBeenCalledExactlyOnceWith(`${kind}-20261109-001`); expect(invoicesApi.enviarBaja).not.toHaveBeenCalled();
});
it.each(['respuesta','error'])('Monitor mantiene Consultando… y deshabilita duplicados hasta %s', async outcome => {
  vi.mocked(invoicesApi.getAgregados).mockResolvedValue([{ id:'a',kind:'RA',identifier:'RA-20261109-001',reference_date:'2026-11-09',state:'POLLING',ticket:'T',transport_uncertain:false,result:null,error:null }]);
  let resolve!: (value:{motivo:string;status:string})=>void; let reject!: (error:Error)=>void;
  vi.mocked(invoicesApi.consultarAgregado).mockImplementation(()=>new Promise((ok,fail)=>{resolve=ok;reject=fail;}));
  render(<InvoiceAggregateMonitor />);
  fireEvent.click(await screen.findByRole('button',{name:'Consultar ticket RA-20261109-001'}));
  expect(screen.getByRole('status').textContent).toContain('Consultando…');
  expect((screen.getByRole('button',{name:'Consultando…'}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button',{name:'Actualizar agregados'}) as HTMLButtonElement).disabled).toBe(true);
  expect(invoicesApi.consultarAgregado).toHaveBeenCalledTimes(1);
  if(outcome==='respuesta')resolve({motivo:'SUNAT sigue procesando',status:'98'});else reject(new Error('Consulta no concluyente'));
  expect(await screen.findByRole('button',{name:'Consultar ticket RA-20261109-001'})).toBeTruthy();
  expect(screen.queryByText(/Consultando… RA/)).toBeNull();
  if(outcome==='respuesta')expect(screen.getByRole('status').textContent).toContain('SUNAT sigue procesando');else expect(screen.getByRole('alert').textContent).toContain('Consulta no concluyente');
});

it('6c-7 muestra tipo, importe y estado recibidos por fila sin recalcular',()=>{
 render(<EnviarBajaPanel fecha="2026-11-09" vista={{...vista,lineas:[{...vista.lineas[0],total:730.17}]}} onEnviado={vi.fn()}/>);
 expect(screen.getByText('Factura (01) · Total: 730.17 · ACEPTADO')).toBeTruthy();expect(invoicesApi.enviarBaja).not.toHaveBeenCalled();
});

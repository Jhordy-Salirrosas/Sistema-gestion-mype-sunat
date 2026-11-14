import { InvoiceOutboxMonitor } from '@/modules/invoices/components/InvoiceOutboxMonitor';
import { InvoiceKpiCards } from '@/modules/invoices/components/InvoiceKpiCards';
import { calcularResumenFiscal } from '@/modules/invoices/lib/invoiceMetrics';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { borradorInicial, vincularDocumentoAfectado } from '@/modules/invoices/lib/invoiceEmitDraft';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { actualizarItem, itemVacio } from '@/modules/invoices/lib/invoiceItems';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { generarTramaQrSunat } from '@/modules/invoices/lib/invoiceCreditAndRules';
import { MOTIVOS_NC, MOTIVOS_ND } from '@/modules/invoices/lib/invoiceEmitValidation';
import { errorDatosTercero } from '@/modules/customs/libPartnerValidation';
import { InvoiceWriteButton } from '@/modules/invoices/components/InvoiceWriteButton';
import { InvoiceEmitMenu } from '@/modules/invoices/components/InvoiceEmitMenu';
import { InvoiceEmitResumen } from '@/modules/invoices/components/InvoiceEmitResumen';
import { InvoiceEmitCamposTributarios } from '@/modules/invoices/components/InvoiceEmitCamposTributarios';
import { contieneDlq, estadoDeMonitor } from '@/modules/invoices/pages/InvoiceMonitorPage';
import { useAuthStore } from '@/stores/authStore';
import type { Role } from '@/modules/auth/types/auth.types';
afterEach(()=>{cleanup();vi.restoreAllMocks();useAuthStore.setState({user:null});});
const origin={...construir({tipo:'01',serie:'F001',correlativo:1,fecha:'2026-11-01',ruc:'20100070970',razonSocial:'Cliente origen',base:100,estado:'ACEPTADO'}),formaPago:'Credito' as const,cuotas:[{numero:'Cuota001',monto:118,vencimiento:'2026-12-01'}]};
it.each([['07','01'],['07','13'],['08','02']] as const)('nota %s/%s mantiene fecha actual y hereda pago solo en 07/13',(tipo,motivo)=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-12T17:00:00Z'));
 const b={...borradorInicial(tipo,'2026-11-10'),documentoAfectado:'F001-00000001',motivoCodigo:motivo};
 const r=vincularDocumentoAfectado(b,[origin]).borrador;
 expect(r.fecha).toBe('2026-11-12');expect(r.clienteDoc).toBe(origin.clienteRuc);expect(r.clienteRazonSocial).toBe(origin.clienteRazonSocial);
 expect(r.formaPago).toBe(motivo==='13'?'Credito':'Contado');expect(r.cuotas).toHaveLength(motivo==='13'?1:0);
});
it.each(['01','03','07','08'] as const)('borrador %s comienza sin líneas libres',tipo=>{
 const b=borradorInicial(tipo,'2026-11-12');expect(b.items).toHaveLength(0);
});
it.each(['EXONERADA','INAFECTA','GRAVADA','GRATUITA'] as const)('cambiar afectación a %s conserva referencia y corrige precio',afectacion=>{
 const line={...itemVacio('i'),codigo:'P',descripcion:'Producto',cantidad:1,valorUnitario:100,precioUnitario:118};
 const [item]=actualizarItem([line],0,{afectacion});expect(item.valorUnitario).toBe(100);
 expect(item.precioUnitario).toBe(afectacion==='GRAVADA'?118:afectacion==='GRATUITA'?0:100);
 const b={...borradorInicial('01','2026-11-12'),clienteDoc:'20100070970',clienteRazonSocial:'Cliente',items:[item]};
 expect(borradorAPayloadEmision(b).items[0].precioUnitario).toBe(item.precioUnitario);
});
it.each(['TRANSPORTE_INCIERTO','PREPARACION_LOCAL'])('DLQ no pierde pertenencia por origen %s',origen=>{
 const inv={resultadoPresentacion:{origen},enDlq:true} as never;
 expect(contieneDlq(inv)).toBe(true);expect(estadoDeMonitor(inv)).toBe(origen==='TRANSPORTE_INCIERTO'?'INCERTIDUMBRE_TRANSPORTE':'PREPARACION_LOCAL');
 expect(contieneDlq({enDlq:false} as never)).toBe(false);
});
it('QR espeja fecha, correlativo sin padding, saneamiento de hash y separador final',()=>{
 expect(generarTramaQrSunat({rucEmisor:'20601234567',tipo:'01',serie:'F001',correlativo:7,igv:18,total:118,fecha:'2026-11-12',tipoDocCliente:'6',numDocCliente:'20100070970',hashCpe:'DI G\nEST=='})).toBe('20601234567|01|F001|00000007|18.00|118.00|2026-11-12|6|20100070970|DIGEST==');
});
it.each(['ADMIN','OPERADOR_FACTURACION','OPERATOR','AUDITOR','CONTADOR','OPERADOR_ADUANAS',undefined])('controles de envío respetan rol %s',role=>{
 useAuthStore.setState({user:role?{id:'u',email:'fake@example.invalid',role:role as Role}:null});const click=vi.fn();
 render(<><InvoiceWriteButton onClick={click}>Enviar</InvoiceWriteButton><InvoiceEmitMenu abierto={false} onToggle={click} onEmitir={click}/></>);
 const allowed=['ADMIN','OPERADOR_FACTURACION','OPERATOR'].includes(role ?? '');const button=screen.getByRole('button',{name:'Enviar'}) as HTMLButtonElement;
 expect(button.disabled).toBe(!allowed);expect((screen.getByRole('button',{name:'Emitir Comprobante'}) as HTMLButtonElement).disabled).toBe(!allowed);
 fireEvent.click(button);expect(click).toHaveBeenCalledTimes(allowed?1:0);
});
it('el permiso no anula el bloqueo operativo ni el título propio',()=>{
 useAuthStore.setState({user:{id:'u',email:'fake@example.invalid',role:'ADMIN'}});
 render(<InvoiceWriteButton disabled title="Procesando">Enviar</InvoiceWriteButton>);
 expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);expect(screen.getByRole('button').title).toBe('Procesando');
});
it('motivos de notas coinciden con los catálogos operativos del backend',()=>{
 expect(MOTIVOS_NC.map(x=>x.codigo)).toEqual(['01','02','03','04','05','06','07','09','10','13']);expect(MOTIVOS_ND.map(x=>x.codigo)).toEqual(['01','02','03','11','12']);
});
it.each([false,true])('documentos de terceros se validan también en edición=%s',editar=>{
 const form={docType:'6',docNumber:'20100070970',legalName:'Cliente',tradeName:'',countryCode:'PE',email:''};
 expect(errorDatosTercero(form,editar)).toBeUndefined();expect(errorDatosTercero({...form,docNumber:'20601234567'},editar)).toMatch(/Documento inválido/);
 expect(errorDatosTercero({...form,docType:'1',docNumber:'1234567'},editar)).toMatch(/Documento inválido/);
});
it.each(['02','03'] as const)('resumen del modal muestra descuento global %s',codigo=>{
 const b={...borradorInicial('01','2026-11-12'),items:[{...itemVacio('x'),codigo:'P',descripcion:'Producto',valorUnitario:100,precioUnitario:118}],descuentoGlobal:{codigo,monto:5}};
 render(<InvoiceEmitResumen borrador={b}/>);expect(screen.getByText(new RegExp(`Descuento global \\(${codigo}\\)`))).toBeTruthy();
});
it('selector tributario ofrece otros códigos vigentes del Catálogo 54',()=>{
 const b=borradorInicial('01','2026-11-12');render(<InvoiceEmitCamposTributarios borrador={b} total={0} actualizar={()=>{}}/>);
 fireEvent.click(screen.getByRole('combobox'));expect(screen.getByRole('option',{name:/037/})).toBeTruthy();
});

it.each([[false,10,false],[true,0,false],[true,10,true]] as const)('KPI mostrarNotas=%s acreditado=%s visibilidad=%s',(mostrarNotas,acreditado,visible)=>{
 render(<InvoiceKpiCards resumen={{...calcularResumenFiscal([]),acreditado}} mostrarNotas={mostrarNotas}/>);
 expect(Boolean(screen.queryByText(/Acreditado/))).toBe(visible);
});
it('el resumen gratuito conserva ICBPER separado y total de cincuenta céntimos',()=>{
 const b={...borradorInicial('01','2026-11-12'),items:[{...itemVacio('x'),codigo:'P',descripcion:'Producto gratuito',afectacion:'GRATUITA' as const,valorUnitario:100,precioUnitario:0,cantidadBolsas:1,icbper:0.5}]};
 render(<InvoiceEmitResumen borrador={b}/>);expect(screen.getByText(/ICBPER.*concepto separado/)).toBeTruthy();
 expect(borradorAPayloadEmision({...b,clienteDoc:'20100070970',clienteRazonSocial:'Cliente'}).items[0].icbper).toBe(0.5);
});

it('la descarga del periodo identifica la propuesta RVIE como CSV',()=>{
 const click=vi.fn();render(<InvoiceOutboxMonitor comprobantes={[origin]} resumen={calcularResumenFiscal([origin])} onExportarSire={click}/>);
 fireEvent.click(screen.getByRole('button',{name:'Exportar propuesta RVIE - SIRE (CSV)'}));expect(click).toHaveBeenCalledWith([origin]);
});
it.each(['01','03'])('bolsas de documento gratuito %s: control visible y guarda anterior al POST',async tipo=>{
 const {InvoiceItemsGrid}=await import('@/modules/invoices/components/InvoiceItemsGrid');
 const {problemasContenidoEmision}=await import('@/modules/invoices/lib/invoiceEmissionValidation');
 const items=[{...itemVacio('x'),codigo:'P',descripcion:'Producto gratuito',afectacion:'GRATUITA' as const,codigoAfectacion:'11',valorUnitario:100,precioUnitario:0,cantidadBolsas:1,icbper:.5}];
 const agregar=vi.fn(), cambiar=vi.fn();render(<InvoiceItemsGrid tipo={tipo} items={items} onCambiar={cambiar} onEliminar={vi.fn()} onAgregar={vi.fn()} onAgregarBolsa={agregar}/>);
 const bloqueada=tipo==='03';expect((screen.getByLabelText('ICBPER de la línea 1') as HTMLInputElement).disabled).toBe(bloqueada);
 expect(screen.queryByRole('button',{name:/Bolsa plástica/})).toBeNull();expect(agregar).not.toHaveBeenCalled();
 if(bloqueada){fireEvent.click(screen.getByRole('button',{name:'Retirar bolsas de la boleta'}));expect(cambiar).toHaveBeenCalledWith(0,{cantidadBolsas:0,icbper:0});}
 expect(Boolean(screen.queryByText(/Una boleta íntegramente gratuita no admite bolsas/))).toBe(bloqueada);
 const error=problemasContenidoEmision({tipo,items,clienteRazonSocial:'Cliente'}).join();expect(error.includes('no admite bolsas')).toBe(bloqueada);
 expect(problemasContenidoEmision({tipo,items:items.map(i=>({...i,cantidadBolsas:0,icbper:0})),clienteRazonSocial:'Cliente'})).toEqual([]);
});
it('QR conserva fecha sin estructura y admite digest ausente',()=>{
 expect(generarTramaQrSunat({rucEmisor:'20601234567',tipo:'01',serie:'F001',correlativo:1,igv:0,total:0,fecha:'sinfecha',tipoDocCliente:'6',numDocCliente:'20100070970'} as never)).toContain('|sinfecha|6|20100070970|');
});
it('motivo 13 sin un origen disponible conserva forma de pago explícita del borrador',()=>{
 const b={...borradorInicial('07','2026-11-12'),motivoCodigo:'13',formaPago:'Contado' as const};expect(vincularDocumentoAfectado(b,[]).borrador.formaPago).toBe('Contado');
});
it('el menú abierto permite elegir cada tipo autorizado',()=>{
 useAuthStore.setState({user:{id:'u',email:'fake@example.invalid',role:'ADMIN'}});const elegir=vi.fn();render(<InvoiceEmitMenu abierto onToggle={vi.fn()} onEmitir={elegir}/>);
 for(const name of ['Factura','Boleta','Nota'])fireEvent.click(screen.getByRole('menuitem',{name}));expect(elegir.mock.calls.map(c=>c[0])).toEqual(['Factura','Boleta','Nota']);
});

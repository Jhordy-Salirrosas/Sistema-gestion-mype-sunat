import {expect,it} from 'vitest';
import {clasificarBandeja,consultarSunatAporta} from '@/modules/invoices/lib/invoiceBandejaState';
import {calcularResumenFiscal} from '@/modules/invoices/lib/invoiceMetrics';
import {aplicarFiltros} from '@/modules/invoices/lib/invoiceFilters';
import {construir} from '@/modules/invoices/data/invoiceDemoTypes';
import type {ResultadoPresentacion} from '@/modules/invoices/lib/invoiceResultPresentation';
export const fila=(n:number,estado='ERROR_RED',origen?:ResultadoPresentacion['origen'],codigo:string|null=null)=>({...construir({tipo:n<10?'03':'01',serie:n<10?'B001':'F001',correlativo:n,fecha:'2026-11-12',ruc:'20100070970',razonSocial:'Ferretería Álvarez',base:100,estado:estado==='ERROR_RED'?'SIN_CONFIRMAR':estado as never}),estadoBackend:estado,resultadoPresentacion:origen?{origen,codigo,motivo:null}:undefined});
it('la expectativa de seis documentos coincide entre KPI y cada filtro: 2/3/1',()=>{
 const rows=[fila(5,'RECHAZADO','NO_DETERMINADO','M1_PREPARATION_DATOS_INVALIDOS'),fila(8,'ERROR_RED','PREPARACION_LOCAL'),fila(9,'ERROR_RED','PREPARACION_LOCAL'),fila(52,'ERROR_RED','TRANSPORTE_INCIERTO'),fila(68,'RECHAZADO','SUNAT'),fila(79,'RECHAZADO','SUNAT')];
 expect(calcularResumenFiscal(rows)).toMatchObject({rechazosSunat:2,bloqueadosLocalmente:3,incertidumbre:1,erroresRed:0});
 for(const [estado,nums] of [['RECHAZADO',[68,79]],['PREPARACION_LOCAL',[5,8,9]],['SIN_CONFIRMAR',[52]]] as const)expect(aplicarFiltros(rows,{busqueda:'',estado,desde:'',hasta:''}).map(x=>x.correlativo)).toEqual(nums);
});
it.each([
 ['ACEPTADO',undefined,'ACEPTADO'],['OBSERVADO',undefined,'OBSERVADO'],['ANULADO','RA_REVERSAL_DONE','ANULADO'],['ERROR_RED',undefined,'ERROR_RED'],['RECHAZADO',undefined,'NO_DETERMINADO'],['RECHAZADO','VALIDACION_LOCAL','PREPARACION_LOCAL'],['ENVIADO',undefined,'EN_COLA'],['PENDIENTE',undefined,'EN_COLA'],['SIN_CONFIRMAR',undefined,'SIN_CONFIRMAR'],
] as const)('estado %s origen %s clasifica %s',(estado,origen,expected)=>expect(clasificarBandeja(fila(1,estado,origen))).toBe(expected));
it('el respaldo de preparación también funciona sin resultadoPresentacion',()=>{
 expect(clasificarBandeja({estado:'RECHAZADO',ultimoErrorCodigo:'M1_PREPARATION_CONFIGURACION'})).toBe('PREPARACION_LOCAL');
 expect(clasificarBandeja({estado:'ACEPTADO'})).toBe('ACEPTADO');
});
it.each([
 ['ERROR_RED',undefined,false,true],['ENVIADO',undefined,false,true],['PENDIENTE',undefined,false,false],['ERROR_RED','TRANSPORTE_INCIERTO',false,true],['ERROR_RED','PREPARACION_LOCAL',false,false],['RECHAZADO','SUNAT',false,false],['ACEPTADO',undefined,true,false],['OBSERVADO',undefined,true,false],['ENVIADO',undefined,undefined,false],['ERROR_RED',undefined,true,false],
] as const)('consulta para %s origen %s CDR %s: %s',(estado,origen,tieneCdr,expected)=>{
 const c={...fila(52,estado,origen),serie:'F001',tieneCdr};expect(consultarSunatAporta(c)).toBe(expected);expect(consultarSunatAporta({...c,serie:'B001'})).toBe(false);
});
it('búsqueda normaliza ambos lados y no confunde correlativo corto con documentos',()=>{
 const a=fila(52,'ACEPTADO'),b={...fila(8,'ACEPTADO'),clienteRuc:'20520000001'},dni={...fila(5,'ACEPTADO'),clienteRuc:'12345678'};
 const buscar=(busqueda:string)=>aplicarFiltros([a,b,dni],{busqueda,estado:'TODOS',desde:'',hasta:''});
 for(const q of ['alvarez','ÁLVAREZ','ferreteria'])expect(buscar(q)).toHaveLength(3);
 expect(buscar('52').map(x=>x.correlativo)).toEqual([52]);expect(buscar('0000052').map(x=>x.correlativo)).toEqual([52]);expect(buscar('00000052').map(x=>x.correlativo)).toEqual([52]);
 expect(buscar('20520000')).toHaveLength(0);expect(buscar('20520000001').map(x=>x.correlativo)).toEqual([8]);expect(buscar('12345678').map(x=>x.correlativo)).toEqual([5]);expect(buscar('f001-00000052').map(x=>x.correlativo)).toEqual([52]);
 expect(buscar('')).toHaveLength(3);expect(buscar('inexistente')).toEqual([]);
});
it('la reversión RA es anulación, y no rechazo aunque el modelo legado lo haya colapsado',()=>{
 expect(clasificarBandeja({estado:'RECHAZADO',resultadoPresentacion:{origen:'RA_REVERSAL_PENDING',codigo:null,motivo:null}})).toBe('ANULADO');
 expect(consultarSunatAporta({estado:'ENVIADO',serie:'F001',tieneCdr:false})).toBe(true);
});
it('el estado ANULADO también se conserva sin metadatos RA',()=>expect(clasificarBandeja({estado:'RECHAZADO',estadoBackend:'ANULADO'})).toBe('ANULADO'));

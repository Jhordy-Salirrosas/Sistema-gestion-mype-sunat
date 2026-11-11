import { transporteAcreditado } from '../../../src/modules/invoices/application/services/invoiceTransportPresentation';
import { aListado } from '../../../src/modules/invoices/application/services/invoiceQueryMapper';
const evento=(codigo_error:string|null,mensaje_error:string|null)=>({codigo_error,mensaje_error,estado_nuevo:'ERROR_RED'});
it('FD01-1 bloqueado localmente no acredita transporte; FD01-2 con inicio sí',()=>{
 expect(transporteAcreditado(null,[evento(null,'Bloqueado antes de enviar por la validación XSL: XSD')])).toBe(false);
 expect(transporteAcreditado(null,[evento('M1_TRANSPORT_STARTED','Conexión a billService')])).toBe(true);
});
it('consulta incierta/rescate no son envío aunque tengan tiempo de respuesta',()=>{
 expect(transporteAcreditado(null,[{...evento('M1_TRANSPORT_UNCERTAIN','Consulta pendiente'),tiempo_respuesta_ms:3000},evento(null,'Rescate manual FD01-2: ENCOLADO')])).toBe(false);
 expect(transporteAcreditado(null,[{...evento('MAX_REINTENTOS','Reintentos agotados: ISSUER_STATUS_UNCERTAIN'),tiempo_respuesta_ms:3000}])).toBe(false);
 expect(transporteAcreditado(null,[])).toBe(false);
});
it('proyecta evidencia anterior a las últimas veinte entradas y no altera estado',()=>{
 const history=[evento('M1_TRANSPORT_STARTED','Inicio'),...Array.from({length:25},()=>evento('M1_TRANSPORT_UNCERTAIN','Consulta pendiente'))];
 expect(aListado({id:'inv',serie:'FD01',correlativo:2,fecha_emision:new Date(),estado:'ERROR_RED',monto_total:118,history} as never)).toMatchObject({transporte_acreditado:true,estado:'ERROR_RED'});
});
it.each([{codigo:'0'},null])('CDR o resultado HTTP son evidencia positiva: %j',cdr=>{
 expect(transporteAcreditado(cdr,[{...evento(null,'Respuesta de transporte'),http_status_code:500}])).toBe(true);
});

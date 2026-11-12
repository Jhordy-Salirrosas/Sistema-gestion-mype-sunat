import { SunatXslValidatorService } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { decidirEnvio, ErrorValidacionBloqueada } from '../../../src/modules/invoices/application/services/invoiceSendGate';
jest.mock('../../../src/modules/invoices/application/services/sunatSfsRunner');
const ejecutar = jest.mocked(ejecutarSfs);
const params = { invoiceId: 'test', tipoComprobante: '01', context: { environment: 'BETA', endpoint: 'https://e-beta.sunat.gob.pe' } } as never;
beforeEach(() => { jest.resetAllMocks(); });
it('valida por SFS aunque quede configurada la antigua variable', async () => {
 const old = process.env.SUNAT_XSL_DIR;
 try {
  process.env.SUNAT_XSL_DIR = '/ruta/inexistente';
  ejecutar.mockResolvedValue({ completado: true, errores: [] });
  expect(await new SunatXslValidatorService().validar('<Invoice/>', '01')).toMatchObject({ valido: true, validadoDeVerdad: true, bloqueado: false });
  expect(ejecutar).toHaveBeenCalledWith('<Invoice/>', '01');
 } finally { if(old === undefined) delete process.env.SUNAT_XSL_DIR; else process.env.SUNAT_XSL_DIR = old; }
});
it('rechaza reglas conocidas y desconocidas conservando su código', async () => {
 ejecutar.mockResolvedValue({ completado: true, errores: [{ codigo:'2027',mensaje:'Descripción inválida',nodo:null },{ codigo:'9999',mensaje:'Regla nueva',nodo:null }] });
 const persistFailure = jest.fn(async () => ({}));
 const r = await decidirEnvio(params, '<Invoice/>', new SunatXslValidatorService(), {persistFailure} as never);
 expect(r.bloqueo?.estado).toBe('RECHAZADO');
 expect(persistFailure).toHaveBeenCalledWith(expect.objectContaining({ codigoError:'2027' }));
});
it.each(['Python ausente','Assets SFS ausentes','Timeout del motor'])('bloquea infraestructura: %s', async message => {
 ejecutar.mockRejectedValue(new Error(message));
 const persistFailure = jest.fn();
 await expect(decidirEnvio(params,'<Invoice/>',new SunatXslValidatorService(),{persistFailure} as never)).rejects.toBeInstanceOf(ErrorValidacionBloqueada);
 expect(persistFailure).not.toHaveBeenCalled();
});
it('un tipo no soportado no invoca el motor',async()=>{
 expect(await new SunatXslValidatorService().validar('<Invoice/>','20')).toMatchObject({bloqueado:true,valido:false});
 expect(ejecutar).not.toHaveBeenCalled();
});

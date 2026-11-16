import { SunatConnectionTestService } from '../../../src/modules/invoices/application/services/sunatConnectionTestService';
const context = { sol:{username:'20000000001FAKE',password:'secret'},certificate:{base64:'private',password:'private'},endpoint:'https://e-factura.sunat.gob.pe/production' };
const cert = {validFrom:new Date('2020-01-01'),validTo:new Date('2099-01-01')};
let fetchMock: jest.Mock; const originalFetch = global.fetch;
beforeEach(()=>{ fetchMock=jest.fn();global.fetch=fetchMock; });
afterAll(()=>{global.fetch=originalFetch;});
function service(c = context, certificate: any = cert) { return new SunatConnectionTestService({resolve:async()=>c} as never,{inspectCertificate:()=>{if(certificate instanceof Error)throw certificate;return certificate;}} as never); }
it('consulta únicamente getStatus en beta fija y conserva el certificado separado',async()=>{
  fetchMock.mockResolvedValue({ok:true,text:async()=>'<Envelope><Body><getStatusResponse><status><statusCode>99</statusCode></status></getStatusResponse></Body></Envelope>'});
  const result = await service().test('company');
  expect(result).toMatchObject({conectado:true,credenciales:'VERIFICADAS_EN_BETA',certificado:{estado:'VIGENTE'}});
  const [url,options]=fetchMock.mock.calls[0];expect(url).toBe('https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService');expect(options.redirect).toBe('error');
  expect(options.body).toContain('getStatus');expect(options.body).not.toMatch(/sendBill|sendSummary/);expect(JSON.stringify(result)).not.toMatch(/secret|private/);
});
it('rechaza credenciales sin devolver el fault ni secretos',async()=>{
  fetchMock.mockResolvedValue({ok:false,text:async()=>'<Envelope><Body><Fault><faultcode>soap:0102</faultcode><faultstring>secret</faultstring></Fault></Body></Envelope>'});
  const result=await service().test('company');expect(result).toMatchObject({conectado:false,credenciales:'RECHAZADAS',codigo:'0102'});expect(JSON.stringify(result)).not.toContain('secret');
});
it('HTTP 200 con HTML no confirma credenciales y un certificado vencido sigue diagnosticándose',async()=>{
  fetchMock.mockResolvedValue({ok:true,text:async()=>'<html>OK</html>'});expect(await service(context,{...cert,validTo:new Date('2000-01-01')}).test('company')).toMatchObject({conectado:false,certificado:{estado:'VENCIDO'}});
});
it('sin SOL no conecta; fallo de red e inspección devuelven diagnóstico sin secretos',async()=>{
  expect((await service({...context,sol:null} as never).test('company')).conectado).toBe(false);expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockRejectedValue(new Error('secret'));const result=await service(context,new Error('private')).test('company');expect(result.conectado).toBe(false);expect(result.certificado.estado).toBe('INVALIDO');expect(JSON.stringify(result)).not.toMatch(/secret|private/);
});

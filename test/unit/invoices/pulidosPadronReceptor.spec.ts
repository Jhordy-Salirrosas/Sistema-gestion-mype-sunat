import { avisosPadronReceptor } from '../../../src/modules/invoices/application/services/receiverRucWarning';
import { AtomicInvoiceCreationService } from '../../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { RucConsultaService } from '../../../src/modules/sunat/rucConsultaService';
const dto = { customer_identity_type: '6', customer_identity_number: '20601030013' } as never;
const datos = { ruc: '20601030013', razonSocial: 'Receptor ficticio', estadoContribuyente: 'ACTIVO', condicionDomicilio: 'HABIDO' };
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
it.each([['ACTIVO', 'HABIDO', 0], ['BAJA DEFINITIVA', 'HABIDO', 1], ['ACTIVO', 'NO HABIDO', 1], ['BAJA TEMPORAL', 'NO_HABIDO', 2], [' activo ', 'no habido', 1]])('aviso solo con respuesta válida %s / %s', async (estado, condicion, cantidad) => {
  const consultar = jest.fn().mockResolvedValue({ ...datos, estadoContribuyente: estado, condicionDomicilio: condicion });
  expect(await avisosPadronReceptor(dto, { consultar })).toHaveLength(cantidad);
  expect(consultar).toHaveBeenCalledWith('20601030013');
});
it.each([404, 422, 503])('HTTP %s no produce aviso ni se interpreta como inactivo', async status => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status } as Response);
  const config = { get: (key: string, fallback?: unknown) => ({ SUNAT_RUC_PROVIDER: 'decolecta', DECOLECTA_API_TOKEN: 'token-ficticio' }[key] ?? fallback) };
  const service = new RucConsultaService({ padronRucCache: { findUnique: async () => null } } as never, config as never);
  expect(await avisosPadronReceptor(dto, service)).toEqual([]); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('una respuesta 200 inactiva del adaptador Decolecta sí se distingue de no encontrado', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ numero_documento: datos.ruc, razon_social: datos.razonSocial, estado: 'BAJA DEFINITIVA', condicion: 'HABIDO' }) } as Response);
  const db = { padronRucCache: { findUnique: async () => null, upsert: async ({ create }: any) => create } };
  const config = { get: (key: string, fallback?: unknown) => ({ SUNAT_RUC_PROVIDER: 'decolecta', DECOLECTA_API_TOKEN: 'token-ficticio' }[key] ?? fallback) };
  expect(await avisosPadronReceptor(dto, new RucConsultaService(db as never, config as never))).toEqual([expect.stringContaining('BAJA DEFINITIVA')]);
});
it('datos insuficientes o un RUC distinto no generan aviso', async () => {
  for (const data of [{ ...datos, ruc: '20100070970' }, { ...datos, razonSocial: '' }, { ...datos, estadoContribuyente: '' }]) {
    expect(await avisosPadronReceptor(dto, { consultar: jest.fn().mockResolvedValue(data) })).toEqual([]);
  }
});
it('DNI, RUC inválido o tipo extranjero no consultan el padrón ni usan el emisor', async () => {
  const consultar = jest.fn();
  for (const d of [{ customer_identity_number: '12345678', customer_identity_type: '1' }, { customer_identity_number: '20100070971', customer_identity_type: '6' }, { customer_identity_number: datos.ruc, customer_identity_type: '0', ruc_emisor: '20100070970' }]) expect(await avisosPadronReceptor(d as never, { consultar })).toEqual([]);
  expect(consultar).not.toHaveBeenCalled();
});
it('confirma la emisión antes de consultar y conserva sus avisos previos', async () => {
  const consultar = jest.fn().mockResolvedValue({ ...datos, condicionDomicilio: 'NO HABIDO' });
  const service = new AtomicInvoiceCreationService({} as never, {} as never, { consultar } as never);
  let confirmar!: (value: unknown) => void;
  jest.spyOn(service as any, 'execute').mockImplementation(() => new Promise(resolve => { confirmar = resolve; }));
  const resultado = { id: 'documento-local', avisos: ['Aviso previo'] };
  const respuesta = service.emitir(dto, 'empresa', 'clave-ficticia-1234'); expect(consultar).not.toHaveBeenCalled();
  confirmar(resultado); expect(await respuesta).toMatchObject({ id: resultado.id, avisos: ['Aviso previo', expect.stringContaining('NO HABIDO')] });
});
it('timeout de dos segundos devuelve exactamente la respuesta confirmada, sin aviso', async () => {
  jest.useFakeTimers(); const consultar = jest.fn(() => new Promise<never>(() => {}));
  const service = new AtomicInvoiceCreationService({} as never, {} as never, { consultar } as never);
  const resultado = { id: 'documento-local', avisos: ['Aviso previo'] }; jest.spyOn(service as any, 'execute').mockResolvedValue(resultado);
  const respuesta = service.emitir(dto, 'empresa', 'clave-ficticia-1234'); await jest.advanceTimersByTimeAsync(2000);
  expect(await respuesta).toBe(resultado);
});
it('fallo de creación no consulta, fallo de red posterior no cambia la respuesta', async () => {
  const consultar = jest.fn().mockRejectedValue(Error('sin red'));
  const service = new AtomicInvoiceCreationService({} as never, {} as never, { consultar } as never);
  const exec = jest.spyOn(service as any, 'execute').mockRejectedValueOnce(Error('no creado'));
  await expect(service.emitir(dto, 'empresa', 'clave-ficticia-1234')).rejects.toThrow('no creado'); expect(consultar).not.toHaveBeenCalled();
  const resultado = { id: 'documento-local', avisos: [] }; exec.mockResolvedValue(resultado); expect(await service.emitir(dto, 'empresa', 'clave-ficticia-1234')).toBe(resultado);
});

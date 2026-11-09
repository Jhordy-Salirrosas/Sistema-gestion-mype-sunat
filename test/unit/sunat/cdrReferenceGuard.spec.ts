import AdmZip from 'adm-zip';
import { assertCdrReference } from '../../../src/modules/sunat/soap/cdrReferenceGuard';
import { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import { SunatStatusConsultaService } from '../../../src/modules/sunat/statusConsultaService';
const expected = { serie: 'F001', correlativo: 60 };
it.each(['F001-60', 'F001-00000060', 'f001-60'])('acepta solo referencia equivalente: %s', (referenceId) => {
  expect(() => assertCdrReference({ referenceId }, expected)).not.toThrow();
});
it.each([null, '', 'F001-61', 'B001-60', 'F001-60-extra', 'F001-00000000060'])('rechaza referencia ausente/ajena: %s', (referenceId) => {
  expect(() => assertCdrReference({ referenceId }, expected)).toThrow('CDR_REFERENCE_MISMATCH');
});
function wrongCdr() {
  const zip = new AdmZip();
  zip.addFile('R-cdr.xml', Buffer.from('<ApplicationResponse><DocumentResponse><Response><ReferenceID>F001-61</ReferenceID><ResponseCode>0</ResponseCode></Response></DocumentResponse></ApplicationResponse>'));
  return zip.toBuffer().toString('base64');
}
it('un CDR aceptado de otro documento no acepta la factura ni habilita reenvío automático', async () => {
  const persist = jest.fn(), persistFailure = jest.fn(async () => ({}));
  const service = new SunatBillService({ persist, persistFailure } as never,
    { sendBill: async () => ({ applicationResponse: wrongCdr(), tiempoRespuestaMs: 1, httpStatus: 200 }) } as never);
  const result = await service.sendAndProcess({ ...expected, invoiceId: 'i', rucEmisor: '20601234567', tipoComprobante: '01', zip: Buffer.from('fixture') });
  expect(result).toMatchObject({ estado: 'ENVIADO', reintentable: false, valido: false, cdr: null });
  expect(persist).not.toHaveBeenCalled();
  expect(persistFailure).toHaveBeenCalledWith(expect.objectContaining({ codigoError: 'CDR_REFERENCE_MISMATCH' }));
});
it('la recuperación de un CDR ajeno permanece incierta y no lo persiste como propio', async () => {
  const persist = jest.fn();
  const service = new SunatStatusConsultaService({ persist } as never, {} as never,
    { getStatusCdr: async () => ({ applicationResponse: wrongCdr(), tiempoRespuestaMs: 1 }) } as never);
  const result = await service.consultar({ ...expected, invoiceId: 'i', rucEmisor: '20601234567', tipoComprobante: '01' });
  expect(result).toMatchObject({ tipo: 'INCIERTO', motivo: expect.stringContaining('CDR_REFERENCE_MISMATCH') });
  expect(persist).not.toHaveBeenCalled();
});

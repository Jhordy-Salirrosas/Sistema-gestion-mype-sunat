import { validarContenidoFiscal } from '../../../src/modules/invoices/validateInvoiceContent';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
const payload = { rucEmisor: '20100070970', razonSocialEmisor: 'Emisor', tipoComprobante: '07', serie: 'FC01', numero: 0, fechaEmision: '2026-11-11', tipoMoneda: 'PEN', tipoOperacion: '0101', documentoAfectado: 'F001-00000069', codigoMotivoNota: '06', descripcionMotivoNota: 'Devolución total' };
it('contenido independiente del correlativo; el generador mantiene su guarda positiva', () => {
  expect(() => validarContenidoFiscal(payload)).not.toThrow();
  expect(() => new UblGeneratorService().generateInvoiceXml(payload)).toThrow('Correlativo');
});
it.each(['rucEmisor', 'razonSocialEmisor', 'tipoComprobante', 'serie', 'fechaEmision', 'tipoMoneda', 'tipoOperacion', 'documentoAfectado', 'codigoMotivoNota', 'descripcionMotivoNota'])('contenido exige %s aun con número cero', campo => {
  expect(() => validarContenidoFiscal({ ...payload, [campo]: '' })).toThrow();
});

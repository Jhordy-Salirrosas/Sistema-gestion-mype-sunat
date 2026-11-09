import type { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';

export const emisorMedioPago = { ruc: '20601012341', razonSocial: 'EMISOR S.A.C.' };

export function formularioMedioPago(): EmitirComprobanteDto {
  return {
    tipo_comprobante: '01', serie: 'F001', forma_pago: 'Contado', fecha_emision: '2026-11-01',
    customer_identity_type: '6', customer_identity_number: '20100066603',
    customer_legal_name: 'CLIENTE S.A.C.', cuenta_banco_nacion: '00019123456',
    items: [{ descripcion: 'Servicio', cantidad: 1, valorUnitario: 1000,
      afectacion: '10', codigoDetraccion: '012' }],
  };
}

export function payloadMedioPago(): InvoicePayload {
  const payload = traducirEmision({ ...formularioMedioPago(), medio_pago_detraccion: '001' }, emisorMedioPago, 1)
    .dto.payload_ubl as unknown as InvoicePayload;
  delete payload.medioPagoDetraccion; // Simula un comprobante histórico anterior a la obligatoriedad.
  return payload;
}

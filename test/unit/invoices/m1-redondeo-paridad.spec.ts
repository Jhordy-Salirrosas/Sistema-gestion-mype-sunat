import casos from '../../fixtures/m1/redondeo-paridad.json';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import type { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';
it.each(casos)('contrato decimal compartido con front: $item.cantidad x $item.precioUnitario, $item.afectacion, $item.descuento.codigo', caso => {
 const d = { tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-11', forma_pago: 'Contado', customer_legal_name: 'Cliente', items: [caso.item] } as EmitirComprobanteDto;
 const r = traducirEmision(d, { ruc: '20000000001', razonSocial: 'Prueba' }, 1);
 expect(r.lineas[0]).toEqual(caso.linea);
 expect(r.importes.total).toBe(caso.total);
 const p = { ...r.dto.payload_ubl, codigoLocalAnexoEmisor: '0000', direccionEmisor: 'Domicilio ficticio', ubigeoEmisor: '150101', departamentoEmisor: 'LIMA', provinciaEmisor: 'LIMA', distritoEmisor: 'LIMA', numeroDocumentoCliente: '20100070970', tipoDocumentoCliente: '6' };
 expect(new UblGeneratorService().generateInvoiceXml(p as never)).toContain(`<cbc:PayableAmount currencyID="PEN">${caso.total.toFixed(2)}</cbc:PayableAmount>`);
});

import { Injectable, BadRequestException } from '@nestjs/common';
import { TASA_IGV } from './sunatCatalogs';
import {
  bloqueCliente,
  bloqueEmisor,
  bloqueFormaPago,
  bloqueLinea,
  bloqueReferenciaNota,
  bloqueUblExtensions,
  esc,
  type LineaDetalle,
  type PartyEmisor,
} from './xmlNodesHelper';
import {
  bloqueImpuestos,
  bloqueRetenciones,
  bloqueTotales,
  calcularRetencion,
  calcularTotales,
  type DatosTributarios,
  type TotalesCalculados,
} from './ublTotalesHelper';
import { construirDocumentoUbl } from './ublDocumentTemplate';
import { asegurarTipoUbl, raizDe } from './ublTipoGuard';
import type { InvoicePayload } from './invoicePayload';

export type { TotalesCalculados } from './ublTotalesHelper';
export type { InvoicePayload } from './invoicePayload';

@Injectable()
export class UblGeneratorService {
  /** Calcula detracción, retención, ICBPER y el importe a pagar. */
  public calcularTotales(payload: DatosTributarios): TotalesCalculados {
    return calcularTotales(payload);
  }

  /** Importe de la retención del IGV redondeado al entero superior. */
  public calcularRetencion(importe: number): number {
    return calcularRetencion(importe);
  }

  /** Genera el XML UBL 2.1 completo del comprobante. */
  public generateInvoiceXml(payload: InvoicePayload): string {
    if (!payload) {
      throw new BadRequestException('El payload del comprobante es obligatorio');
    }

    const tipo = payload.tipoComprobante ?? '01';

    asegurarTipoUbl(tipo);

    const raiz = raizDe(tipo);
    const moneda = payload.tipoMoneda ?? 'PEN';
    const serie = payload.serie ?? 'F001';
    const numero = payload.numero ?? 1;
    const documentoId = `${serie}-${numero.toString().padStart(8, '0')}`;
    const tipoOperacion = payload.tipoOperacion ?? '0101';
    const formaPago = payload.formaPago === 'Credito' ? 'Credito' : 'Contado';

    const emisor: PartyEmisor = {
      ruc: payload.rucEmisor ?? '',
      razonSocial: payload.razonSocialEmisor ?? '',
      nombreComercial: payload.nombreComercialEmisor,
      ubigeo: payload.ubigeoEmisor,
      direccion: payload.direccionEmisor,
      departamento: payload.departamentoEmisor,
      provincia: payload.provinciaEmisor,
      distrito: payload.distritoEmisor,
    };

    const totales = calcularTotales(payload);
    const clienteXml = payload.cliente
      ? `\n${bloqueCliente(payload.cliente)}`
      : '';
    const referenciaNota =
      payload.documentoAfectado && (tipo === '07' || tipo === '08')
        ? `\n${bloqueReferenciaNota(
            payload.documentoAfectado,
            payload.codigoMotivoNota ?? '01',
            payload.descripcionMotivoNota ?? 'Anulación de la operación',
          )}`
        : '';
    const observaciones = payload.observaciones
      ? `\n  <cbc:Note><![CDATA[${payload.observaciones}]]></cbc:Note>`
      : '';
    const ordenCompra = payload.ordenCompra
      ? `\n  <cac:OrderReference>\n    <cbc:ID>${esc(payload.ordenCompra)}</cbc:ID>\n  </cac:OrderReference>`
      : '';

    const impuestos = [
      ...bloqueImpuestos(totales, moneda, TASA_IGV),
      ...bloqueRetenciones(totales, moneda),
    ].join('\n');

    return construirDocumentoUbl({
      raiz,
      documentoId: esc(documentoId),
      tipo: esc(tipo),
      tipoOperacion: esc(tipoOperacion),
      moneda,
      fecha: esc(payload.fechaEmision ?? ''),
      hora: esc(payload.horaEmision ?? '10:00:00'),
      extensiones: bloqueUblExtensions(),
      emisor: bloqueEmisor(emisor),
      cliente: clienteXml,
      formaPago: bloqueFormaPago(formaPago, moneda, payload.cuotas ?? []),
      impuestos,
      totales: bloqueTotales(totales, moneda),
      lineas: this.lineasDe(payload).join('\n'),
      opcionales: `${observaciones}${ordenCompra}${referenciaNota}`,
    });
  }

  /** Lista de líneas del comprobante (admite `linea` suelta por compatibilidad). */
  private lineasDe(payload: InvoicePayload): string[] {
    const moneda = payload.tipoMoneda ?? 'PEN';
    const crudas = payload.lineas ?? (payload.linea ? [payload.linea] : []);

    if (crudas.length > 0) return crudas.map((l) => bloqueLinea(l, moneda));

    // Retrocompatibilidad: sin detalle se sintetiza una línea con los totales.
    const igv = payload.montoIgv ?? 0;
    const linea: LineaDetalle = {
      id: 1,
      descripcion: 'Servicio prestado',
      cantidad: 1,
      valorUnitario: payload.montoGravado ?? 0,
      afectacion: '10',
      totalLinea: (payload.montoGravado ?? 0) + igv,
      igvLinea: igv,
    };

    return [bloqueLinea(linea, moneda)];
  }
}

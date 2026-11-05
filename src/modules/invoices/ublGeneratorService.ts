import { Injectable, BadRequestException } from '@nestjs/common';
import { TASA_IGV } from './sunatCatalogs';
import {
  bloqueCliente,
  bloqueEmisor,
  bloqueFormaPago,
  bloqueLeyenda2006,
  bloqueLinea,
  bloquePaymentMeansDetraccion,
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
  type LineaTributaria,
  type TotalesCalculados,
} from './ublTotalesHelper';
import { construirDocumentoUbl } from './ublDocumentTemplate';
import { asegurarTipoUbl, raizDe } from './ublTipoGuard';
import { lineaBolsaIcBper } from './ublIcbperLine';
import { esUnidadFerreteria } from './sunatCatalogsQuery';
import {
  esOperacionConDetraccion,
  montoNetoPendiente,
  validarDetraccion,
  validarPago,
} from './application/services/paymentTermsAndSpotValidator';
import type { InvoicePayload } from './invoicePayload';

export type { TotalesCalculados } from './ublTotalesHelper';
export type { InvoicePayload } from './invoicePayload';

/** Redondeo monetario a dos decimales sin arrastrar error de coma flotante. */
const centimos = (valor: number): number => Math.round(valor * 100) / 100;

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

    // BUG corregido en TA-63: aquí se llamaba a `calcularTotales(payload)`,
    // SIN pasar por `conLineas()`. El payload de la API no trae
    // `lineasTributarias` (lo construye `conLineas` a partir de `lineas`), así
    // que el cálculo caía en la rama sin detalle y usaba `montoTotal`, que
    // quien arma el payload puede no haber rellenado: llegaba 0 y la regla
    // 3319 rechazaba todo cronograma al crédito con "neto pendiente 0.00".
    const totales = calcularTotales(this.conLineas(payload));
    const clienteXml = payload.cliente
      ? `\n${bloqueCliente(payload.cliente)}`
      : '';

    // TA-63: validar el pago ANTES de construir nada. Un cronograma que no
    // cuadra o una cuota vencida en el pasado se detecta aquí, con un mensaje
    // que dice qué línea está mal; descubrirlo por el CDR de SUNAT cuesta el
    // envío y el rechazo no indica cuál de las cuotas falla.
    validarPago({
      formaPago,
      montoTotal: totales.total,
      fechaEmision: payload.fechaEmision ?? '',
      cuotas: payload.cuotas ?? [],
      detraccion: totales.detraccion,
      tipoOperacion,
    });

    validarDetraccion({
      codigoDetraccion: payload.codigoDetraccion,
      moneda,
      montoTotal: totales.total,
      tipoComprobante: tipo,
    });

    // TA-63: solo una venta al crédito declara el neto pendiente en la
    // cabecera de FormaPago; es lo que la regla 3319 compara con la suma de
    // las cuotas.
    const netoPendiente =
      formaPago === 'Credito'
        ? montoNetoPendiente({
            montoTotal: totales.total,
            detraccion: totales.detraccion,
          })
        : undefined;

    const conDetraccion = esOperacionConDetraccion(tipoOperacion);
    const leyenda2006 =
      conDetraccion && payload.montoEnLetras
        ? `\n${bloqueLeyenda2006(payload.montoEnLetras)}`
        : '';
    const mediosPago = conDetraccion
      ? bloquePaymentMeansDetraccion(payload.cuentaBancoNacion)
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

    // ORDEN EXIGIDO POR EL ESQUEMA UBL 2.1 (defecto encontrado contra SUNAT BETA)
    //
    // Se envió de verdad y el billService respondió con `0306 cvc-particle 2.1`
    // señalando el elemento mal ubicado. Pasó dos veces:
    //   1) con `PaymentTerms` de detracción antes de `LegalMonetaryTotal`;
    //   2) al moverlos después de `LegalMonetaryTotal`, porque entonces esperaba
    //      `InvoiceLine`.
    //
    // Conclusión verificada: TODOS los `cac:PaymentTerms` (forma de pago,
    // detracción y retención) van juntos al principio, antes de los `TaxTotal`.
    // La secuencia que acepta el esquema es:
    //
    //   cac:PaymentTerms   (contado/crédito, detracción, retención)
    //   cac:TaxTotal       ...
    //   cac:LegalMonetaryTotal
    //   cac:InvoiceLine    ...
    //
    // Los tests unitarios no lo detectaron porque comparan fragmentos sueltos y
    // ninguno valida el orden contra el XSD. Solo apareció emitiendo de verdad,
    // que es justo lo que el docente pedía probar.
    const impuestos = bloqueImpuestos(totales, moneda, TASA_IGV).join('\n');

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
      /**
       * LAS NOTAS NO LLEVAN FORMA DE PAGO.
       *
       * Una Nota de Crédito o de Débito no es una venta: no se cobra, solo
       * ajusta un comprobante anterior. SUNAT la rechaza con el código 3246
       * ("El tipo de transacción o el identificador de la cuota no cumple con el
       * formato esperado") señalando `cac:PaymentTerms/cbc:PaymentMeansID` con el
       * valor 'Contado'.
       *
       * Tampoco llevan cronograma de cuotas: esos datos son del documento
       * original. Se detectó emitiendo una NC contra BETA el 31-10; ningún test
       * emitía una nota de punta a punta.
       */
      formaPago:
        raiz === 'Invoice'
          ? bloqueFormaPago(formaPago, moneda, payload.cuotas ?? [], netoPendiente)
          : '',
      mediosPago,
      // Detracción y retención: van con los demás PaymentTerms, al principio.
      // La detracción necesita su código del Catálogo 54 (012, 037...).
      retenciones: bloqueRetenciones(
        totales,
        moneda,
        payload.codigoDetraccion,
      ).join('\n'),
      descuentoGlobal: payload.descuentoGlobal ? [
        '  <cac:AllowanceCharge>',
        '    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>',
        `    <cbc:AllowanceChargeReasonCode listAgencyName="PE:SUNAT" listName="Cargo/descuento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo53">${esc(payload.descuentoGlobal.codigo)}</cbc:AllowanceChargeReasonCode>`,
        `    <cbc:MultiplierFactorNumeric>${(payload.descuentoGlobal.monto / (totales.baseDescuentoGlobal ?? 1)).toFixed(5)}</cbc:MultiplierFactorNumeric>`,
        `    <cbc:Amount currencyID="${moneda}">${payload.descuentoGlobal.monto.toFixed(2)}</cbc:Amount>`,
        `    <cbc:BaseAmount currencyID="${moneda}">${(totales.baseDescuentoGlobal ?? 0).toFixed(2)}</cbc:BaseAmount>`,
        '  </cac:AllowanceCharge>',
      ].join('\n') : '',
      impuestos,
      totales: bloqueTotales(totales, moneda),
      /**
       * Las NOTAS no llevan `cac:InvoiceLine`: el esquema UBL 2.1 usa
       * `cac:CreditNoteLine` para la Nota de Crédito (07) y `cac:DebitNoteLine`
       * para la de Débito (08). SUNAT rechaza el XML si aparece InvoiceLine
       * ("found <cac:InvoiceLine>, but next item should be CreditNoteLine").
       *
       * La raíz ya se elegía bien con `raizDe`, pero las líneas se emitían
       * siempre como InvoiceLine. Se detectó emitiendo una NC contra BETA.
       */
      lineas: this.lineasDe(payload, raiz).join('\n'),
      // `cbc:Note` (leyenda 2006 y observaciones) va antes de
      // DocumentCurrencyCode; la referencia de nota, después de las partes.
      notas: `${leyenda2006}${observaciones}`,
      referenciaNota: `${ordenCompra}${referenciaNota}`,
    });
  }

  /**
   * Traduce las líneas del payload al contrato del cálculo tributario.
   *
   * Se hace aquí y no en `calcularTotales` para que ese módulo siga siendo
   * puro y no dependa de la forma del payload UBL.
   */
  private conLineas(payload: InvoicePayload): DatosTributarios {
    const crudas = payload.lineas ?? (payload.linea ? [payload.linea] : []);
    if (crudas.length === 0) return payload;

    const lineas: LineaTributaria[] = crudas.map((l) => ({
      afectacion: l.afectacion,
      valorVenta: l.totalLinea - l.igvLinea,
      igv: l.igvLinea,
      icbper: l.icbperLinea,
    }));

    // La bolsa plástica aporta su ICBPER aunque no esté en `lineas`: el
    // payload puede declararla solo como cantidad.
    const bolsas = payload.bolsasIcBper ?? 0;
    if (bolsas > 0 && !lineas.some((l) => (l.icbper ?? 0) > 0)) {
      lineas.push({ afectacion: '10', valorVenta: 0, igv: 0 });
    }

    // TA-63: el importe de las líneas se usa como `montoTotal` cuando quien
    // arma el payload no lo informó. `calcularTotales` prefiere `montoTotal`
    // sobre la suma calculada (`payload.montoTotal ?? ...`), de modo que un
    // payload con `montoTotal: 0` —el caso real de la API, que solo envía las
    // líneas— dejaba el neto en 0.00 y rechazaba todo cronograma al crédito.
    const totalLineas = centimos(
      lineas.reduce((suma, l) => suma + l.valorVenta + l.igv, 0),
    );

    return {
      ...payload,
      otrosDescuentos: crudas.flatMap((l) => l.descuentos ?? []).filter((d) => d.codigo === '01').reduce((suma, d) => suma + d.monto, 0),
      montoTotal: payload.montoTotal > 0 ? payload.montoTotal : totalLineas,
      lineasTributarias: lineas,
    };
  }

  /**
   * Valida las unidades y añade la línea del ICBPER (TA-62).
   *
   * El ICBPER va como línea INDEPENDIENTE del detalle (regla 3306), siempre al
   * final, para que la numeración de las líneas de mercadería no cambie.
   */
  private lineasDe(
    payload: InvoicePayload,
    raiz: 'Invoice' | 'CreditNote' | 'DebitNote' = 'Invoice',
  ): string[] {
    const moneda = payload.tipoMoneda ?? 'PEN';
    const crudas = payload.lineas ?? (payload.linea ? [payload.linea] : []);

    const validadas = crudas.map((linea) => {
      const unidad = (linea.unidad ?? 'NIU').trim().toUpperCase();
      // Una unidad fuera del Catálogo 03 hace que la hoja oficial devuelva
      // error 2xxx sobre el `unitCode`. Se rechaza antes, con un mensaje que
      // dice qué valor se acepta.
      if (!esUnidadFerreteria(unidad)) {
        throw new BadRequestException(
          `La unidad '${linea.unidad}' de la línea ${linea.id} no pertenece al ` +
            'Catálogo 03 (se aceptan NIU, DZN, CEN, MIL, KGM, MTR, BG, BX)',
        );
      }
      return { ...linea, unidad };
    });

    if (validadas.length === 0) {
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
      return [bloqueLinea(linea, moneda, raiz)];
    }

    const xml = validadas.map((l) => bloqueLinea(l, moneda, raiz));

    // ICBPER: se añade su línea al final si el payload declara bolsas y
    // ninguna línea del detalle ya la representa.
    const bolsas = payload.bolsasIcBper ?? 0;
    const yaIncluida = validadas.some((l) => (l.icbperLinea ?? 0) > 0);
    if (bolsas > 0 && !yaIncluida) {
      const linea = lineaBolsaIcBper(validadas.length + 1, { cantidad: bolsas });
      if (linea) xml.push(bloqueLinea(linea, moneda, raiz));
    }

    return xml;
  }
}

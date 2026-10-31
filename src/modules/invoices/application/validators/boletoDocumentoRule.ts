/**
 * Regla del documento del cliente en Boleta (TA-60, HU-09).
 *
 * El criterio del backlog es concreto: "al emitir Boleta (03) se exige DNI/RUC
 * cuando monto_total > S/ 700".
 *
 * Por qué existe esta regla y no es un capricho del curso: la Boleta de Venta
 * es el comprobante del consumidor final y se puede emitir de forma anónima
 * (`DocTypeCode` 0, "DOCUMENTO NACIONAL DE IDENTIDAD" sin número). Pero la Ley
 * 30313 y la R.S. 251-2014 obligan a identificar al adquiriente cuando la
 * operación alcanza ese monto, porque a partir de ahí la SUNAT sí puede
 * cruzarla con la declaración del comprador. Una boleta de S/ 5 000 sin DNI es
 * un documento que SUNAT observa (o rechaza) después del envío, con los
 * intentos del backoff ya gastados.
 *
 * El umbral es ESTRICTO (`> 700`): una boleta de exactamente S/ 700.00 puede
 * quedar anónima. Se usa `>` y no `>=` porque el texto de la norma y el
 * backlog dicen "superior a"; invertirlo obligaría a pedir DNI en boletas de
 * consumo menor y molestaría a la cajera.
 *
 * Esta función es PURA y NO depende de class-validator: se ejecuta en el caso
 * de uso para que las pruebas la midan directamente y para que la misma regla
 * se pueda llamar desde el `bulk` de la bandeja.
 */
/** Boleta de venta: código 03 del Catálogo 01 (SUNAT). */
export const TIPO_BOLETA = '03';

/** Monto a partir del cual la Boleta exige identificar al adquiriente. */
export const UMBRAL_DOCUMENTO_BOLETA_SOLES = 700;

/**
 * Identificador del comprobante que reporta el problema.
 *
 * Se declara aquí y no se importa de un DTO para que la regla se pueda usar
 * tanto en el `class-validator` como en el caso de uso sin crear un ciclo.
 */
export interface DocumentoCliente {
  /** DNI (8), RUC (11), carné de extranjería (12) o pasaporte. */
  numero?: string | null;
  /** Tipo del Catálogo 06: 1 = DNI, 6 = RUC, 4 = CE, 7 = Pasaporte. */
  tipo?: string | null;
}

/** Motivo por el que el documento no sirve, o `null` si es válido. */
export type FaltaDocumento = 'SIN_DOCUMENTO' | 'DOCUMENTO_INVALIDO' | null;

/**
 * ¿Hace falta exigir el documento del cliente para este comprobante?
 *
 * Solo la Boleta (03); la Factura (01) siempre lo exige por su propia
 * naturaleza (se emite a un RUC), y las notas heredan el del documento
 * afectado, así que no entran aquí.
 */
export function exigeDocumentoCliente(params: {
  tipoComprobante: string;
  montoTotal: number;
}): boolean {
  const tipo = (params.tipoComprobante ?? '').trim().padStart(2, '0');
  if (tipo !== TIPO_BOLETA) return false;

  // Se compara en céntimos enteros: `700.001 > 700` es true en coma flotante
  // después de cualquier redondeo y produciría un rechazo incomprensible para
  // un monto que el usuario ve como 700.00.
  return enCentimos(params.montoTotal) > enCentimos(UMBRAL_DOCUMENTO_BOLETA_SOLES);
}

/** Convierte un monto a céntimos enteros, sin arrastrar error flotante. */
function enCentimos(monto: number): number {
  if (!Number.isFinite(monto)) return 0;
  return Math.round(monto * 100);
}

/**
 * Valida el documento del cliente según la regla del monto.
 *
 * @returns `null` si se puede emitir; el motivo concreto si no.
 */
export function validarDocumentoCliente(params: {
  tipoComprobante: string;
  montoTotal: number;
  cliente?: DocumentoCliente | null;
}): FaltaDocumento {
  if (!exigeDocumentoCliente(params)) return null;

  const numero = (params.cliente?.numero ?? '').replace(/\s|-/g, '');
  if (!numero) return 'SIN_DOCUMENTO';

  const tipo = (params.cliente?.tipo ?? '').trim();
  // Catálogo 06: 1 DNI (8 dígitos), 6 RUC (11), 4 CE (12), 7 Pasaporte (≤12).
  const longitudPorTipo: Record<string, RegExp> = {
    '1': /^\d{8}$/,
    '6': /^\d{11}$/,
    '4': /^[A-Za-z0-9]{12}$/,
    '7': /^[A-Za-z0-9]{1,12}$/,
  };

  const patron = longitudPorTipo[tipo];
  if (!patron) return 'DOCUMENTO_INVALIDO';
  return patron.test(numero) ? null : 'DOCUMENTO_INVALIDO';
}

/** Mensaje para el usuario, con el monto real y el umbral. */
export function mensajeDocumentoCliente(
  motivo: Exclude<FaltaDocumento, null>,
  montoTotal: number,
): string {
  const monto = montoTotal.toFixed(2);
  if (motivo === 'SIN_DOCUMENTO') {
    return (
      `Una boleta de S/ ${monto} supera los S/ ${UMBRAL_DOCUMENTO_BOLETA_SOLES}.00: ` +
      'se debe identificar al cliente con DNI o RUC'
    );
  }
  return (
    `El documento del cliente no es válido para una boleta de S/ ${monto}: ` +
    'DNI de 8 dígitos, RUC de 11, CE de 12 o pasaporte alfanumérico'
  );
}

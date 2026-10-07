/**
 * classifyCdr(): clasificacion final combinando el codigo de respuesta con las
 * observaciones del CDR.
 *
 * Es el matiz que mas se equivoca en las integraciones: un CDR ACEPTADO CON
 * OBSERVACIONES sigue trayendo codigo 0. Las observaciones (4xxx) viajan en
 * Note a nivel de raiz. Si solo se mira el codigo, un comprobante observado se
 * guarda como "aceptado limpio" y la observacion se pierde. Ver ADR-05.
 */
import { InvoiceStatus } from '../../../generated/prisma/enums';
import { classifyResponseCode, CdrClassification } from './cdr-classifier';
import { ParsedCdr } from './cdr.parser';

export function classifyCdr(cdr: ParsedCdr): CdrClassification {
  const base = classifyResponseCode(cdr.responseCode);

  // Un observado es codigo 0 MAS al menos una observacion.
  if (cdr.responseCode !== '0' || cdr.observaciones.length === 0) {
    return {
      status: base.status,
      kind: base.kind,
      valido: base.valido,
      reintentable: base.reintentable,
    };
  }

  return {
    status: InvoiceStatus.ACEPTADO,
    kind: 'ACEPTADO_CON_OBSERVACIONES',
    valido: true,
    reintentable: false,
  };
}

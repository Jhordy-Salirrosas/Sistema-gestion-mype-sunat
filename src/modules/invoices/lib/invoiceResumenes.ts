/**
 * Contrato de la vista previa de resúmenes diarios (RC) y bajas (RA) — TA-67.
 *
 * Traduce `GET /api/v1/invoices/resumenes/diario` y `.../baja`.
 *
 * POR QUÉ ES UN OBJETO CON LÍNEAS Y MOTIVOS Y NO UNA LISTA DE COMPROBANTES
 *
 * Un resumen no es un comprobante: la respuesta tiene que decir qué se enviaría,
 * qué se deja fuera y POR QUÉ. Sin el motivo, el usuario emite 10 boletas, ve 7
 * en el resumen, y concluye que el sistema perdió 3.
 */

/** Línea de la vista previa. */
/** Estados en los que el comprobante nunca llegó a SUNAT y admite reenvío. */
export const ESTADOS_REENVIABLES_SUNAT = ['PENDIENTE', 'EN_COLA', 'ERROR_RED', 'SIN_CONFIRMAR'] as const;

/** ¿El comprobante nunca llegó a SUNAT y puede reenviarse desde la fila? */
export const esLineaReenviable = (linea: Pick<LineaResumen, 'estado' | 'reenviable'>): boolean =>
  linea.reenviable ?? (ESTADOS_REENVIABLES_SUNAT as readonly string[]).includes(linea.estado);

/** Etiqueta legible del estado frente a SUNAT en Bajas y Resúmenes. */
export const ETIQUETA_ESTADO_SUNAT: Record<string, string> = {
  ACEPTADO: 'Aceptado por SUNAT',
  OBSERVADO: 'Observado por SUNAT',
  RECHAZADO: 'Rechazado por SUNAT',
  ANULADO: 'Anulado (Baja)',
  PENDIENTE: 'No enviado a SUNAT (Pendiente)',
  EN_COLA: 'No enviado a SUNAT (En cola)',
  ERROR_RED: 'Error de transporte (ver motivo)',
  SIN_CONFIRMAR: 'Sin confirmación de SUNAT',
  ENVIADO: 'Enviado a SUNAT',
};

export interface LineaResumen {
  id?: string;
  serie: string;
  correlativo: number;
  tipoComprobante: string;
  fechaEmision: string;
  estado: string;
  reenviable?: boolean;
  total: number;
  /** `true` si entra en el XML que se enviaría. */
  incluido: boolean;
  /** Motivo por el que no entra; cadena vacía si entra. */
  motivoExclusion: string;
  /** Días desde la emisión hasta la fecha de referencia (regla 2957). */
  dias: number | null;
}

/** Envío agregado (RC o RA). */
export interface EnvioAgregado {
  identificador: string;
  tipo: 'RESUMEN_DIARIO' | 'COMUNICACION_BAJA';
  fechaReferencia: string;
  correlativo: number;
  lineas: number;
}

/** Respuesta completa de la vista previa. */
export interface VistaPreviaResumen {
  envio: EnvioAgregado;
  lineas: readonly LineaResumen[];
  /** XML que se enviaría; `null` si no hay nada que informar. */
  xml: string | null;
  errores: readonly string[];
}

/** Etiqueta legible del tipo de comprobante. */
export const ETIQUETA_TIPO: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'Nota de crédito',
  '08': 'Nota de débito',
};

/**
 * Resumen de la vista previa para pintar en la cabecera.
 *
 * Función pura para poder probar el conteo sin montar la pantalla: el número
 * que se muestra tiene que ser el mismo que el de `envio.lineas`.
 */
export const resumirVista = (
  vista: VistaPreviaResumen | null | undefined,
): { incluidos: number; excluidos: number; importe: number } => {
  const lineas = vista?.lineas ?? [];
  const incluidos = lineas.filter((l) => l.incluido);

  return {
    incluidos: incluidos.length,
    excluidos: lineas.length - incluidos.length,
    importe: Math.round(
      (incluidos.reduce((acc, l) => acc + (Number.isFinite(l.total) ? l.total : 0), 0) +
        Number.EPSILON) *
        100,
    ) / 100,
  };
};

/** ¿La vista tiene algo que enviar? */
export const hayAlgoQueEnviar = (
  vista: VistaPreviaResumen | null | undefined,
): boolean => (vista?.xml ?? '') !== '';

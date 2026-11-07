/**
 * Catálogo 54 de detracción y reglas del pago al crédito en el frontend (TA-64).
 *
 * El formulario ofrecía "Detracción SPOT" como un porcentaje suelto (4 %, 10 %,
 * 12 %), pero SUNAT no pide un porcentaje: pide un CÓDIGO del Catálogo 54, y
 * cada código tiene su porcentaje, su descripción y su vigencia. Un 12 % sin
 * código no se puede escribir en el XML, y el 4 % sin decir "027 - Flete
 * terrestre" deja al usuario adivinando a qué operación se refiere.
 *
 * Además aquí viven las dos comprobaciones que el backend aplica sobre el
 * cronograma, replicadas para que el usuario las vea ANTES de enviar:
 *
 *  - **3319**: la suma de las cuotas debe igualar exactamente el neto
 *    pendiente. Ni un céntimo.
 *  - **3267**: ninguna cuota puede vencer el mismo día de la emisión ni antes.
 *
 * Replicarlas aquí no sustituye la validación del backend —que es la única que
 * decide— sino que evita el viaje de ida y vuelta con un mensaje que el usuario
 * puede corregir en el mismo formulario.
 */
import { round2 } from './invoiceTaxes';
import { fechaIsoValida } from './invoiceFecha';

/** Operación sujeta a detracción según el Catálogo 54. */
export interface CodigoDetraccion {
  codigo: string;
  descripcion: string;
  porcentaje: number;
}

/** Códigos vigentes del Catálogo 54 que se ofrecen en el formulario. */
export const CODIGOS_DETRACCION: readonly CodigoDetraccion[] = [
  { codigo: '012', descripcion: 'Intermediación laboral y tercerización', porcentaje: 0.12 },
  { codigo: '019', descripcion: 'Arrendamiento de bienes', porcentaje: 0.1 },
  { codigo: '022', descripcion: 'Otros servicios empresariales', porcentaje: 0.12 },
  { codigo: '027', descripcion: 'Flete terrestre', porcentaje: 0.04 },
  { codigo: '035', descripcion: 'Bienes exonerados del IGV', porcentaje: 0.015 },
  { codigo: '037', descripcion: 'Demás servicios gravados con el IGV', porcentaje: 0.12 },
  { codigo: '039', descripcion: 'Minerales no metálicos', porcentaje: 0.1 },
] as const;

/**
 * Códigos que SUNAT dio de baja.
 *
 * Se listan para poder RECHAZARLOS con un mensaje explicativo en lugar de
 * dejarlos pasar: muchos usuarios los tienen en plantillas de Excel antiguas y
 * el rechazo llegaría recién con el CDR.
 */
export const CODIGOS_DETRACCION_DADOS_DE_BAJA: readonly string[] = [
  '006',
  '018',
  '029',
  '033',
];

/** Umbral en soles por encima del cual la operación está sujeta a detracción. */
export const UMBRAL_DETRACCION = 700;

/** Busca un código del Catálogo 54 vigente. */
export const buscarDetraccion = (
  codigo: string,
): CodigoDetraccion | undefined =>
  CODIGOS_DETRACCION.find((d) => d.codigo === codigo.trim().padStart(3, '0'));

/** ¿El código fue dado de baja por SUNAT? */
export const esDetraccionDadaDeBaja = (codigo: string): boolean =>
  CODIGOS_DETRACCION_DADOS_DE_BAJA.includes(
    codigo.trim().padStart(3, '0'),
  );

/**
 * Importe de la detracción del comprobante: porcentaje del total, a céntimos.
 *
 * Devuelve 0 si no hay código, si el código no existe o si el total no supera
 * el umbral de S/ 700. El umbral se mide sobre el total del comprobante.
 */
export const montoDetraccionPara = (
  total: number,
  codigo: string | undefined,
): number => {
  if (!codigo) return 0;
  const entrada = buscarDetraccion(codigo);
  if (!entrada) return 0;
  if (!(total > UMBRAL_DETRACCION)) return 0;
  return round2(total * entrada.porcentaje);
};

/** Referencia a una cuota tal como la edita el usuario. */
export interface CuotaBorrador {
  monto: number;
  /** Fecha de vencimiento en formato YYYY-MM-DD. */
  vencimiento: string;
}

/** Cuota ya normalizada, lista para el XML. */
export interface CuotaCalculada {
  numero: string;
  monto: number;
  vencimiento: string;
}

/** Motivos por los que el cronograma todavía no sirve. */
export interface ResultadoCuotas {
  cuotas: readonly CuotaCalculada[];
  errores: readonly string[];
  /** Monto que debería sumar el cronograma. */
  netoPendiente: number;
  suma: number;
  /** Diferencia entre lo que suman las cuotas y el neto. */
  diferencia: number;
  /** ¿Cuadra exactamente, al céntimo? */
  cuadra: boolean;
}

/**
 * Reparte el neto en partes iguales y carga el residuo a la última cuota.
 *
 * Es la forma de que la regla 3319 se cumpla SIEMPRE al generar: 1000 entre 3
 * da 333.33 + 333.33 + 333.34, no tres veces 333.33 (que suma 999.99).
 */
export const repartirEnCuotas = (
  neto: number,
  numeroCuotas: number,
  fechaEmision: string,
  diasEntreCuotas = 30,
): readonly CuotaCalculada[] => {
  if (!(neto > 0) || numeroCuotas < 1) return [];

  const montoCuota = round2(neto / numeroCuotas);
  const base = new Date(`${fechaEmision}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return [];

  return Array.from({ length: numeroCuotas }, (_, i) => {
    const esUltima = i === numeroCuotas - 1;
    const monto = esUltima
      ? round2(neto - montoCuota * (numeroCuotas - 1))
      : montoCuota;
    const vence = new Date(base);
    vence.setUTCDate(vence.getUTCDate() + diasEntreCuotas * (i + 1));
    return {
      numero: `Cuota${String(i + 1).padStart(3, '0')}`,
      monto,
      vencimiento: vence.toISOString().slice(0, 10),
    };
  });
};

/**
 * Valida un cronograma EDITADO a mano contra el neto pendiente.
 *
 * Se usa cuando el usuario decide sus propios importes o fechas en lugar de
 * aceptar el reparto automático.
 */
export const validarCronograma = (
  cuotas: readonly CuotaBorrador[],
  netoPendiente: number,
  fechaEmision: string,
): ResultadoCuotas => {
  const errores: string[] = [];
  const normalizadas: CuotaCalculada[] = cuotas.map((c, i) => ({
    numero: `Cuota${String(i + 1).padStart(3, '0')}`,
    monto: Number.isFinite(c.monto) ? c.monto : 0,
    vencimiento: c.vencimiento,
  }));

  if (normalizadas.length === 0) {
    errores.push('Un pago al crédito necesita al menos una cuota.');
  }

  const emision = Date.parse(`${fechaEmision}T00:00:00Z`);
  if (!fechaIsoValida(fechaEmision)) errores.push('La fecha de emisión no es válida.');

  for (const cuota of normalizadas) {
    if (Math.abs(cuota.monto * 100 - Math.round(cuota.monto * 100)) > 1e-7) {
      errores.push(`La ${cuota.numero} no puede tener fracciones de céntimo.`);
    }
    if (!cuota.vencimiento) {
      errores.push(`La ${cuota.numero} no tiene fecha de vencimiento.`);
      continue;
    }
    if (!fechaIsoValida(cuota.vencimiento)) {
      errores.push(`La ${cuota.numero} tiene una fecha de vencimiento inválida.`);
      continue;
    }
    const vence = Date.parse(`${cuota.vencimiento}T00:00:00Z`);
    if (Number.isNaN(vence) || Number.isNaN(emision)) continue;
    // Regla 3267.
    if (vence <= emision) {
      errores.push(
        `La ${cuota.numero} vence el ${cuota.vencimiento}, que no es posterior ` +
          `a la emisión (${fechaEmision}).`,
      );
    }
    if (!(cuota.monto > 0)) {
      errores.push(`La ${cuota.numero} tiene un importe de cero.`);
    }
  }

  const suma = round2(normalizadas.reduce((acc, c) => acc + c.monto, 0));
  const neto = round2(netoPendiente);
  const diferencia = round2(neto - suma);
  // Regla 3319: comparación en céntimos enteros, sin tolerancia.
  const cuadra = Math.round(suma * 100) === Math.round(neto * 100);

  if (normalizadas.length > 0 && !cuadra) {
    errores.push(
      `Las cuotas suman ${suma.toFixed(2)} y el neto pendiente es ` +
        `${neto.toFixed(2)}: faltan ${diferencia.toFixed(2)}.`,
    );
  }

  return { cuotas: normalizadas, errores, netoPendiente: neto, suma, diferencia, cuadra };
};

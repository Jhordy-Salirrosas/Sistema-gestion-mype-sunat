/**
 * Regla de la Nota de Crédito y de Débito sobre un comprobante existente (M1).
 *
 * LO QUE DIJO EL DOCENTE (31-10, parte 1)
 *
 *   "La nota de crédito es cuando va a haber alguna devolución... Pero es sobre
 *    el documento que ya está, o sea, no empiezas haciendo una nota de crédito.
 *    Entonces, tú hay que replantearlo."
 *
 * Y en la recapitulación: "es sobre el documento que ya está, no empiezas
 * haciendo una nota de crédito".
 *
 * El modal ya dejaba escribir un «Documento afectado» y avisaba cuando no
 * existía, pero el aviso era solo eso: un texto rojo. Nada impedía pulsar
 * «Emitir» con el campo vacío o con un número inventado, así que el flujo que el
 * docente objetó seguía siendo posible.
 *
 * Por qué es un módulo aparte: la regla tiene dos partes que conviene probar sin
 * montar React —qué documentos son elegibles y qué bloquea la emisión—, y el
 * modal ya está en el límite de líneas del proyecto.
 */
import type { ComprobanteDemo } from '../data/invoiceDemoTypes';
import type { BorradorEmision } from './invoiceEmitDraft';

/** Estructura mínima para decidir si un comprobante puede recibir una nota. */
type ComprobanteElegible = Pick<
  ComprobanteDemo,
  'id' | 'tipo' | 'estado' | 'clienteRuc' | 'fechaEmision'
> & {
  /**
   * Serie y correlativo: son la identidad FISCAL del comprobante.
   *
   * `numero` trae la forma completa (`F001-00000045`) cuando viene del backend;
   * `serie` + `correlativo` se usan como respaldo. `id` es el UUID de la base y
   * NO sirve para lo que escribe el usuario en el mostrador.
   */
  numero?: string;
  serie?: string;
  correlativo?: number;
};

/** Comprobante en la forma que consume el buscador de origen. */
export type { ComprobanteElegible };

/**
 * ¿Este comprobante admite una nota de crédito o débito?
 *
 * Solo facturas y boletas aceptadas por SUNAT.
 *
 *  - **No es una nota.** Una nota que modifica otra nota es un caso que SUNAT
 *    admite pero que este módulo no emite: se cambiaría algo que ya modificó un
 *    documento anterior y el saldo se volvería difícil de seguir.
 *  - **Está ACEPTADO.** Un comprobante que SUNAT no aceptó no existe
 *    fiscalmente; una nota sobre él sería un documento huérfano.
 *
 * (La anulación se gestiona por la comunicación de baja, no por un estado
 * propio: un comprobante dado de baja deja de listarse, así que aquí no hay un
 * estado "ANULADO" que comprobar.)
 */
export const admiteNota = (comprobante: ComprobanteElegible): boolean => {
  if (comprobante.tipo === '07' || comprobante.tipo === '08') return false;
  return comprobante.estado === 'ACEPTADO';
};

/**
 * Comprobantes que el usuario puede elegir para afectar con una nota.
 *
 * Se ordenan del más reciente al más antiguo: lo normal es devolver la última
 * venta, no la de hace tres meses.
 */
export const comprobantesElegibles = (
  existentes: readonly ComprobanteElegible[],
): readonly ComprobanteElegible[] =>
  existentes
    .filter(admiteNota)
    .slice()
    .sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision));

/**
 * Número fiscal legible de un comprobante: `F001-00000045`.
 *
 * Se prefiere el `numero` que ya trae el backend; si no está, se arma con la
 * serie y el correlativo a ocho dígitos. Devuelve cadena vacía si no hay datos
 * suficientes, para no generar un número falso.
 */
export const numeroFiscal = (c: ComprobanteElegible): string => {
  const directo = (c.numero ?? '').trim();
  if (directo) return directo.toUpperCase();

  const serie = (c.serie ?? '').trim().toUpperCase();
  if (!serie || c.correlativo === undefined) return '';
  return `${serie}-${String(c.correlativo).padStart(8, '0')}`;
};

/**
 * Busca el comprobante que la nota va a modificar.
 *
 * POR QUÉ SE COMPARA POR NÚMERO Y NO POR `id`
 *
 * Antes esta función hacía `c.id === buscado`, y `id` es el **UUID** de la base
 * (`d819ddb0-64de-4a17-...`). El usuario escribe el número del comprobante
 * (`F001-00000045`), así que la comparación no podía acertar NUNCA: cualquier
 * número real respondía "No existe el comprobante en esta empresa" y ninguna
 * nota podía nacer de un documento emitido, que es justo lo que el docente
 * pidió replantear. El fallo no dependía de la sesión ni de la empresa.
 *
 * Se acepta tanto el número completo como el correlativo suelto, y la
 * comparación ignora mayúsculas y espacios porque en el mostrador se teclea
 * "f001-45" o "  F001-00000045 ".
 */
export const buscarAfectado = <T extends ComprobanteElegible>(
  existentes: readonly T[],
  numero: string,
): T | undefined => {
  const buscado = numero.trim().toUpperCase().replace(/\s+/g, '');
  if (!buscado) return undefined;

  // 1) Número fiscal canónico: F001-00000045.
  const porNumero = existentes.find((c) => numeroFiscal(c) === buscado);
  if (porNumero) return porNumero;

  // 2) Número sin los ceros de relleno: el usuario escribe "F001-45" y en los
  //    datos demo el id también omite los ceros. Se compara serie y correlativo
  //    ya normalizados, no el texto literal.
  const partes = buscado.match(/^(.+?)-0*(\d+)$/);
  if (partes) {
    const [, serieBuscada, correlativoBuscado] = partes;
    const correlativo = Number(correlativoBuscado);
    const porSerieYNumero = existentes.find(
      (c) =>
        (c.serie ?? '').trim().toUpperCase() === serieBuscada &&
        c.correlativo === correlativo,
    );
    if (porSerieYNumero) return porSerieYNumero;
  }

  // 3) Solo el correlativo ("45"), si no hay ambigüedad entre series.
  if (/^\d+$/.test(buscado)) {
    const correlativo = Number(buscado);
    const candidatos = existentes.filter((c) => c.correlativo === correlativo);
    if (candidatos.length === 1) return candidatos[0];
  }

  return undefined;
};

/** Problema que impide emitir una nota, con el texto para mostrarlo. */
export interface ProblemaNota {
  /** Campo del formulario al que corresponde el problema. */
  campo: 'documentoAfectado' | 'motivo' | 'monto';
  mensaje: string;
}

/**
 * Revisa si la nota se puede emitir.
 *
 * Devuelve la lista de problemas en el orden en que el usuario debería
 * corregirlos: primero el documento, después el motivo y por último el importe.
 *
 * El último control es el que evita el descuadre más caro: una nota de crédito
 * que devuelve más de lo que costó el comprobante original. SUNAT la acepta
 * (solo mira que el documento relacionado exista) pero el saldo del cliente
 * queda negativo y el cuadre de ventas deja de cerrar.
 */
export const problemasDeNota = (
  borrador: BorradorEmision,
  existentes: readonly ComprobanteElegible[],
  totalNota: number,
): readonly ProblemaNota[] => {
  const problemas: ProblemaNota[] = [];

  const referencia = borrador.documentoAfectado.trim();

  if (!referencia) {
    return [
      {
        campo: 'documentoAfectado',
        mensaje:
          'Una nota se emite sobre un comprobante existente: elija el documento ' +
          'que va a modificar. No se empieza por la nota.',
      },
    ];
  }

  const afectado = buscarAfectado(existentes, referencia);

  if (!afectado) {
    problemas.push({
      campo: 'documentoAfectado',
      mensaje: `No existe el comprobante ${referencia} en esta empresa.`,
    });
    return problemas;
  }

  if (!admiteNota(afectado)) {
    problemas.push({
      campo: 'documentoAfectado',
      mensaje:
        afectado.tipo === '07' || afectado.tipo === '08'
          ? `${referencia} ya es una nota: elija la factura o boleta original.`
          : `${referencia} está ${afectado.estado.toLowerCase()}: no admite notas.`,
    });
  }

  // El documento afectado y la nota tienen que ser del MISMO cliente. Esta es
  // una regla de SUNAT (el XML lleva el mismo adquirente) y, sobre todo, evita
  // devolverle dinero a quien no compró.
  const docCliente = borrador.clienteDoc.replace(/\D/g, '');
  const docAfectado = afectado.clienteRuc.replace(/\D/g, '');

  if (docCliente && docAfectado && docCliente !== docAfectado) {
    problemas.push({
      campo: 'documentoAfectado',
      mensaje:
        `El comprobante ${referencia} es de otro cliente ` +
        `(${afectado.clienteRuc}). La nota debe emitirse a nombre de quien compró.`,
    });
  }

  if (!borrador.motivoCodigo.trim()) {
    problemas.push({
      campo: 'motivo',
      mensaje:
        'Indique el motivo de la nota (Catálogo 09): sin código, SUNAT la rechaza.',
    });
  }

  if (!(totalNota > 0)) {
    problemas.push({
      campo: 'monto',
      mensaje: 'La nota no puede emitirse con importe cero.',
    });
  }

  return problemas;
};

/**
 * ¿La nota se puede emitir sin problemas?
 *
 * Atajo para el botón «Emitir» del modal, que necesita la respuesta en una
 * expresión booleana.
 */
export const notaSePuedeEmitir = (
  borrador: BorradorEmision,
  existentes: readonly ComprobanteElegible[],
  totalNota: number,
): boolean => problemasDeNota(borrador, existentes, totalNota).length === 0;

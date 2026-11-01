/**
 * Validación previa del documento del adquirente (TA-60, Eje 6).
 *
 * CUÁNDO SE APLICA CADA REGLA
 *
 *  - **Factura (01) y sus notas:** el receptor debe ser un RUC de 11 dígitos
 *    que supere el Módulo 11. Una factura a un DNI no existe en el SEE.
 *  - **Boleta (03):** el adquirente es opcional hasta S/ 700.00; por encima de
 *    ese importe la identificación pasa a ser obligatoria (RS 000003-2023).
 *    En la Región Selva el umbral baja a S/ 350.00.
 *
 * POR QUÉ EL UMBRAL ES UN PARÁMETRO Y NO UNA CONSTANTE LEÍDA DEL ENTORNO
 *
 * El umbral depende de dónde está el establecimiento, no de la instalación: la
 * misma empresa puede tener un local en Lima y otro en Iquitos. Se recibe por
 * parámetro para que quien emite decida con el dato de la sucursal, y el valor
 * por defecto sea el general.
 *
 * LO QUE ESTE ARCHIVO NO HACE
 *
 * No consulta el padrón de SUNAT. La condición ACTIVO/HABIDO del contribuyente
 * vive en `padron_ruc_cache`, que requiere una migración y una fuente de
 * actualización que todavía no existen en el repositorio; el estado de esa
 * deuda está en `specs/DEUDA_PADRON_RUC.md`. Este validador comprueba lo que se
 * puede comprobar sin red: forma, prefijo, dígito verificador e importe.
 */
import { BadRequestException } from '@nestjs/common';

/** Catálogo 06: tipos de documento de identidad del adquirente. */
export const TIPOS_DOCUMENTO_ADQUIRENTE: readonly string[] = [
  '0', // Doc. tributario no domiciliado, sin RUC
  '1', // DNI
  '4', // Carné de extranjería
  '6', // RUC
  '7', // Pasaporte
];

/** Código del RUC dentro del Catálogo 06. */
export const TIPO_DOC_RUC = '6';

/** Código del DNI dentro del Catálogo 06. */
export const TIPO_DOC_DNI = '1';

/** Importe a partir del cual la boleta exige identificar al comprador. */
export const UMBRAL_BOLETA_IDENTIFICADA = 700;

/** Umbral reducido de la Región Selva (Ley 27037, art. 4). */
export const UMBRAL_BOLETA_SELVA = 350;

/** Prefijos de RUC válidos para SUNAT. */
export const PREFIJOS_RUC: readonly string[] = ['10', '15', '17', '20'];

/** Pesos del algoritmo Módulo 11, de izquierda a derecha. */
const PESOS_MODULO_11 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/**
 * Comprueba el dígito verificador de un RUC con el Módulo 11 de SUNAT.
 *
 * Se multiplica cada uno de los 10 primeros dígitos por su peso, se suma, se
 * toma el resto módulo 11 y se resta de 11. Los casos 10 y 11 se convierten en
 * 0 y 1 respectivamente; cualquier otro valor es el dígito esperado.
 */
export const digitoVerificadorRuc = (ruc: string): number | null => {
  if (!/^\d{11}$/.test(ruc)) return null;

  let suma = 0;
  for (let i = 0; i < 10; i += 1) {
    suma += Number(ruc.charAt(i)) * PESOS_MODULO_11[i];
  }

  let diferencia = 11 - (suma % 11);
  if (diferencia === 10) diferencia = 0;
  if (diferencia === 11) diferencia = 1;

  return diferencia;
};

/** ¿El RUC tiene 11 dígitos, prefijo válido y dígito verificador correcto? */
export const esRucValido = (ruc: string): boolean => {
  const limpio = (ruc ?? '').trim();
  if (!/^\d{11}$/.test(limpio)) return false;
  if (!PREFIJOS_RUC.includes(limpio.substring(0, 2))) return false;
  return digitoVerificadorRuc(limpio) === Number(limpio.charAt(10));
};

/** ¿El DNI tiene los 8 dígitos que exige SUNAT en el Catálogo 06? */
export const esDniValido = (dni: string): boolean =>
  /^\d{8}$/.test((dni ?? '').trim());

/** Datos del adquirente tal como llegan de la emisión. */
export interface Adquirente {
  tipoDoc: string;
  numeroDoc: string;
  razonSocial?: string;
}

/** Datos del comprobante que condicionan la identificación. */
export interface EmisionAValidar {
  tipoComprobante: string;
  /** Importe total a pagar del comprobante. */
  importeTotal: number;
  /** `true` si el establecimiento está en la Región Selva. */
  enSelva?: boolean;
}

/** Error 422: los datos son del cliente, no un fallo del servidor. */
const rechazo = (code: string, message: string): BadRequestException =>
  new BadRequestException({ code, message });

/**
 * Umbral de identificación aplicable según el establecimiento.
 *
 * Se expone como función y no como ternario en línea porque el valor tiene que
 * poder citarse en un mensaje de error y en una prueba sin duplicarlo.
 */
export const umbralIdentificacion = (enSelva = false): number =>
  enSelva ? UMBRAL_BOLETA_SELVA : UMBRAL_BOLETA_IDENTIFICADA;

/**
 * Valida el documento del adquirente antes de emitir.
 *
 * @throws BadRequestException (422) si el documento no corresponde al tipo de
 *   comprobante o si la boleta superó el umbral sin identificar al comprador.
 *   Devuelve `void` cuando la emisión puede seguir.
 */
export const validarAdquirente = (
  adquirente: Adquirente | null | undefined,
  emision: EmisionAValidar,
): void => {
  const tipo = emision.tipoComprobante.trim().padStart(2, '0');
  const numero = (adquirente?.numeroDoc ?? '').trim();
  const tipoDoc = (adquirente?.tipoDoc ?? '').trim();

  // Las notas (07/08) heredan la exigencia del documento que modifican: una
  // nota a factura lleva RUC; una nota a boleta puede ir sin documento.
  const exigeRuc = tipo === '01' || tipo === '07' || tipo === '08';

  if (exigeRuc) {
    if (!numero) {
      throw rechazo(
        'ADQUIRENTE_SIN_DOCUMENTO',
        `El comprobante de tipo ${tipo} exige el RUC del adquirente.`,
      );
    }
    if (tipoDoc && tipoDoc !== TIPO_DOC_RUC) {
      throw rechazo(
        'ADQUIRENTE_RUC_OBLIGATORIO',
        `El comprobante de tipo ${tipo} solo admite RUC (Catálogo 06 código 6) ` +
          `como documento del adquirente; se recibió el tipo ${tipoDoc}.`,
      );
    }
    if (!esRucValido(numero)) {
      throw rechazo(
        'ADQUIRENTE_RUC_INVALIDO',
        `El RUC ${numero} no supera la validación Módulo 11 de SUNAT ` +
          '(SUNAT lo rechazaría con los códigos 2027 u otro de la serie 2000).',
      );
    }
    return;
  }

  if (tipo !== '03') return;

  // Boleta: sin documento solo si no pasa el umbral.
  if (!numero) {
    const umbral = umbralIdentificacion(emision.enSelva);
    if (emision.importeTotal > umbral) {
      throw rechazo(
        'BOLETA_SIN_ADQUIRENTE',
        `La boleta por S/ ${emision.importeTotal.toFixed(2)} supera el umbral ` +
          `de S/ ${umbral.toFixed(2)}${emision.enSelva ? ' de la Región Selva' : ''} ` +
          'y exige identificar al comprador con su documento y nombre completo.',
      );
    }
    return;
  }

  if (!TIPOS_DOCUMENTO_ADQUIRENTE.includes(tipoDoc)) {
    throw rechazo(
      'ADQUIRENTE_TIPO_INVALIDO',
      `El tipo de documento ${tipoDoc || '(vacío)'} no existe en el Catálogo 06. ` +
        `Los válidos son ${TIPOS_DOCUMENTO_ADQUIRENTE.join(', ')}.`,
    );
  }

  if (tipoDoc === TIPO_DOC_RUC && !esRucValido(numero)) {
    throw rechazo(
      'ADQUIRENTE_RUC_INVALIDO',
      `El RUC ${numero} no supera la validación Módulo 11 de SUNAT.`,
    );
  }

  if (tipoDoc === TIPO_DOC_DNI && !esDniValido(numero)) {
    throw rechazo(
      'ADQUIRENTE_DNI_INVALIDO',
      `El DNI ${numero} debe tener exactamente 8 dígitos.`,
    );
  }
};

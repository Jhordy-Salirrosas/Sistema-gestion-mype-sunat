/**
 * Alertas operativas del módulo de facturación (TA-69).
 *
 * Traduce `GET /api/v1/invoices/alertas` a lo que pinta la barra de avisos.
 *
 * POR QUÉ UN ARCHIVO APARTE DEL DE MÉTRICAS
 *
 * Las métricas son cifras del periodo y su pantalla tolera que lleguen un poco
 * tarde. Las alertas son otra cosa: el certificado que vence mañana y los
 * comprobantes trabados en la cola de muertos obligan a actuar hoy, y por eso
 * tienen su propio endpoint y su propia normalización.
 *
 * QUÉ SIGNIFICA `SIN_DATOS`
 *
 * Que la alerta no se pudo calcular, no que esté todo bien. Se pinta distinto
 * del verde a propósito: un verde por "no lo pude comprobar" es el falso
 * positivo que hace desconfiar de la pantalla entera.
 */

/** Gravedad de una alerta, en orden creciente. */
export type GravedadAlerta = 'OK' | 'AVISO' | 'CRITICO' | 'SIN_DATOS';

/** Estado del certificado digital de firma. */
export interface AlertaCertificado {
  evaluado: boolean;
  diasRestantes: number | null;
  venceEl: string | null;
  gravedad: GravedadAlerta;
  mensaje: string;
}

/** Estado de la cola de muertos. */
export interface AlertaDlq {
  evaluado: boolean;
  pendientes: number;
  gravedad: GravedadAlerta;
  mensaje: string;
}

export interface AlertaAntiguedadEnvio {
  evaluado: boolean; gravedad: GravedadAlerta; mensaje: string;
  documentos: { id: string; numero: string; tipoComprobante: string; estado: string; fechaEmision: string; fechaLimite: string; diasRestantes: number }[];
}

/** Respuesta completa de `GET /api/v1/invoices/alertas`. */
export interface AlertasOperativas {
  certificado: AlertaCertificado;
  dlq: AlertaDlq;
  antiguedad?: AlertaAntiguedadEnvio;
  gravedadGlobal: GravedadAlerta;
  consultadoEl: string;
}

/** Valores neutros mientras llega la respuesta. */
export const ALERTAS_VACIAS: AlertasOperativas = {
  certificado: {
    evaluado: false,
    diasRestantes: null,
    venceEl: null,
    gravedad: 'SIN_DATOS',
    mensaje: 'Consultando el certificado digital…',
  },
  dlq: {
    evaluado: false,
    pendientes: 0,
    gravedad: 'SIN_DATOS',
    mensaje: 'Consultando la cola de muertos…',
  },
  gravedadGlobal: 'SIN_DATOS',
  consultadoEl: '',
};

/** Orden de gravedad, para comparar. */
const ORDEN: readonly GravedadAlerta[] = ['OK', 'SIN_DATOS', 'AVISO', 'CRITICO'];

/** ¿La cadena es una gravedad conocida? */
export const esGravedad = (valor: unknown): valor is GravedadAlerta =>
  typeof valor === 'string' && ORDEN.includes(valor as GravedadAlerta);

/** La gravedad más alta de la lista. */
export const gravedadMaxima = (
  gravedades: readonly GravedadAlerta[],
): GravedadAlerta =>
  gravedades.reduce<GravedadAlerta>(
    (max, g) => (ORDEN.indexOf(g) > ORDEN.indexOf(max) ? g : max),
    'OK',
  );

/**
 * Normaliza lo que llegue del backend.
 *
 * Un campo ausente se rellena con un valor neutro en lugar de `undefined`,
 * porque un `undefined` en la pantalla pinta "NaN días" o "undefined
 * comprobantes" en medio de la demostración.
 *
 * La gravedad global se RECALCULA sobre las dos alertas ya normalizadas en vez
 * de confiar en la del backend: si una llega corrupta, la global tiene que
 * reflejarlo.
 */
export const normalizarAlertas = (
  crudo: Partial<AlertasOperativas> | null | undefined,
): AlertasOperativas => {
  const cert = crudo?.certificado;
  const dlq = crudo?.dlq;

  const dias = Number(cert?.diasRestantes);
  const pendientes = Number(dlq?.pendientes);

  const certificado: AlertaCertificado = {
    evaluado: Boolean(cert?.evaluado),
    diasRestantes: Number.isFinite(dias) ? dias : null,
    venceEl: typeof cert?.venceEl === 'string' ? cert.venceEl : null,
    gravedad: esGravedad(cert?.gravedad) ? cert.gravedad : 'SIN_DATOS',
    mensaje:
      typeof cert?.mensaje === 'string' && cert.mensaje.trim() !== ''
        ? cert.mensaje
        : 'El estado del certificado digital no está disponible.',
  };

  const alertaDlq: AlertaDlq = {
    evaluado: Boolean(dlq?.evaluado),
    pendientes: Number.isFinite(pendientes) ? pendientes : 0,
    gravedad: esGravedad(dlq?.gravedad) ? dlq.gravedad : 'SIN_DATOS',
    mensaje:
      typeof dlq?.mensaje === 'string' && dlq.mensaje.trim() !== ''
        ? dlq.mensaje
        : 'El estado de la cola de muertos no está disponible.',
  };

  const edad = crudo?.antiguedad;
  const antiguedad: AlertaAntiguedadEnvio | undefined = edad ? {
    evaluado: Boolean(edad.evaluado), gravedad: esGravedad(edad.gravedad) ? edad.gravedad : 'SIN_DATOS',
    mensaje: typeof edad.mensaje === 'string' ? edad.mensaje : 'Antigüedad de envío no disponible.',
    documentos: Array.isArray(edad.documentos) ? edad.documentos.filter(d => d && typeof d.id === 'string' && typeof d.numero === 'string' && typeof d.fechaLimite === 'string' && Number.isFinite(d.diasRestantes)) : [],
  } : undefined;
  return {
    certificado,
    dlq: alertaDlq,
    ...(antiguedad ? { antiguedad } : {}),
    gravedadGlobal: gravedadMaxima([certificado.gravedad, alertaDlq.gravedad, ...(antiguedad ? [antiguedad.gravedad] : [])]),
    consultadoEl:
      typeof crudo?.consultadoEl === 'string' ? crudo.consultadoEl : '',
  };
};

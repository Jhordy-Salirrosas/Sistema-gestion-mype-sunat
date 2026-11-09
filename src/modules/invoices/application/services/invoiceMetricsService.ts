import { redondearMoneda as r2 } from '../../money';
/**
 * Métricas del módulo de facturación (TA-69, HU-12).
 *
 * La pantalla del M1 necesita una barra de resumen —cuántos comprobantes, cuánto
 * facturado, cuántos rechazados— y hoy no existe: el front calcula los KPIs
 * sobre los datos que ya tiene cargados, lo que da cifras distintas según la
 * página que el usuario esté viendo.
 *
 * Este servicio los calcula en el servidor, sobre TODA la empresa y el periodo,
 * no sobre la página visible.
 *
 * Dos decisiones que cambian los números:
 *
 *  - **Las Notas de Crédito RESTAN.** Un resumen que suma boletas y resta notas
 *    de débito da una cifra de venta inflada. El importe neto es
 *    `facturas + boletas + notas de débito − notas de crédito`.
 *  - **Los rechazados no cuentan como venta.** Un comprobante rechazado por
 *    SUNAT no existe ante la administración tributaria; contarlo como facturado
 *    es cómodo y falso.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

/** Resumen de métricas del periodo. */
export interface MetricasFacturacion {
  /** Comprobantes emitidos en el periodo, sin contar los rechazados. */
  emitidos: number;
  /** Comprobantes rechazados por SUNAT en el periodo. */
  rechazados: number;
  /** Comprobantes aceptados u observados. */
  aceptados: number;
  /** Comprobantes todavía en cola o en error de red. */
  pendientes: number;
  /**
   * Comprobantes que no pudieron enviarse por un fallo de comunicación.
   *
   * No son ventas confirmadas ni rechazos: existen, pero SUNAT no confirmó nada
   * y su importe queda FUERA de `facturado*`. Se informan aparte para que la
   * pantalla pueda decir "1 sin confirmar" en lugar de esconderlo dentro de
   * "pendientes" o, peor, contarlo como facturado.
   */
  erroresRed: number;
  /** Importe facturado, ya con las notas de crédito restadas. */
  facturado: number;
  /** Importe total bruto, sin descontar notas de crédito. */
  facturadoBruto: number;
  /** Importe acreditado por notas de crédito. */
  acreditado: number;
  /** Importe bruto de las notas de débito. */
  debitado: number;
  /** Porcentaje de aceptación sobre los comprobantes procesados. */
  tasaAceptacion: number;
  /** Periodo consultado, YYYY-MM. */
  periodo: string;
}

/**
 * Estados que cuentan como "emitido sin rechazo".
 *
 * `ERROR_RED` está aquí a propósito: el comprobante salió y puede que SUNAT lo
 * tenga; lo que falló fue la comunicación. No es una venta confirmada, pero
 * tampoco un rechazo.
 */
export const ESTADOS_VALIDOS = ['ACEPTADO', 'OBSERVADO', 'EN_COLA', 'ENVIADO', 'PENDIENTE', 'ERROR_RED'];

/** Estados que cuentan como pendientes de resolución. */
export const ESTADOS_PENDIENTES = ['EN_COLA', 'ENVIADO', 'PENDIENTE', 'ERROR_RED'];

/** Redondeo monetario a céntimos. */


/** Rango de fechas de un periodo YYYY-MM. */
export const rangoDelPeriodo = (
  periodo: string,
): { desde: Date; hasta: Date } => {
  const [anio, mes] = periodo.split('-').map(Number);
  // El día 0 del mes siguiente es el último día del mes pedido: así diciembre
  // no necesita un caso especial y los meses de 30 días tampoco.
  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes, 1));
  return { desde, hasta };
};

/** Periodo YYYY-MM actual en hora de Perú. */
export const periodoActual = (): string => {
  const ahora = new Date();
  // Lima es UTC-5 todo el año (sin horario de verano desde 1994), así que el
  // periodo no salta de mes a las 19:00 como si se usara UTC directamente.
  const lima = new Date(ahora.getTime() - 5 * 60 * 60 * 1000);
  return lima.toISOString().slice(0, 7);
};

/**
 * Calcula las métricas a partir de los agregados por tipo y estado.
 *
 * Es una función pura: recibe las sumas ya hechas para poder probarla sin base
 * de datos, y porque la aritmética es justamente lo que se equivoca.
 */
export const calcularMetricas = (
  filas: readonly { tipoComprobante: string; estado: string; total: number }[],
  periodo: string,
): MetricasFacturacion => {
  let emitidos = 0;
  let rechazados = 0;
  let aceptados = 0;
  let pendientes = 0;
  let erroresRed = 0;
  let facturadoBruto = 0;
  let acreditado = 0;
  let debitado = 0;

  for (const fila of filas) {
    const total = Number.isFinite(fila.total) ? fila.total : 0;

    if (fila.estado === 'RECHAZADO') {
      rechazados += 1;
      continue;
    }
    if (fila.estado === 'ANULADO') continue;

    /*
     * `ERROR_RED` significa que la petición no llegó a completarse: el
     * comprobante existe pero SUNAT no confirmó nada. Antes contaba como
     * "emitido" y su importe entraba en `facturadoBruto`, así que una factura
     * que nunca llegó a SUNAT sostenía la cifra de venta. Ahora se cuenta
     * aparte, sin sumar importes, igual que un rechazado.
     */
    if (fila.estado === 'ERROR_RED') {
      erroresRed += 1;
      pendientes += 1;
      continue;
    }

    emitidos += 1;
    if (fila.estado === 'ACEPTADO' || fila.estado === 'OBSERVADO') aceptados += 1;
    if (ESTADOS_PENDIENTES.includes(fila.estado)) pendientes += 1;

    // Las notas de crédito devuelven y las de débito aumentan.
    if (fila.tipoComprobante === '07') acreditado += total;
    else if (fila.tipoComprobante === '08') debitado += total;
    else facturadoBruto += total;
  }

  const procesados = aceptados + rechazados;
  const tasaAceptacion =
    procesados === 0 ? 0 : Math.round((aceptados / procesados) * 10000) / 100;

  return {
    emitidos,
    rechazados,
    aceptados,
    pendientes,
    erroresRed,
    facturadoBruto: r2(facturadoBruto + debitado),
    acreditado: r2(acreditado),
    debitado: r2(debitado),
    facturado: r2(facturadoBruto + debitado - acreditado),
    tasaAceptacion,
    periodo,
  };
};

/**
 * Expande el resultado de un `groupBy` de Prisma a una fila por comprobante.
 *
 * POR QUÉ EXISTE ESTA FUNCIÓN
 *
 * `prisma.invoice.groupBy({ by: ['tipo_comprobante','estado'] })` devuelve una
 * fila por COMBINACIÓN, no una por documento. Al pasar esos grupos directamente
 * a `calcularMetricas` se contaba un grupo como si fuera un solo comprobante:
 * con 23 comprobantes reales (18 aceptados, 5 rechazados) las tarjetas decían
 * "3 aceptados, 1 rechazado, 75 %" mientras la tabla mostraba 18 y 5.
 *
 * El importe se reparte a partes iguales entre las filas del grupo. Repartir en
 * lugar de asignarlo todo a la primera no cambia ninguna suma —`n × (total/n)`
 * es `total`— y evita que un grupo inflado por una sola factura arrastre un
 * promedio falso si mañana se añade un cálculo por documento.
 *
 * `_count` es opcional en el tipo para que la firma sea honesta: si Prisma no
 * lo devolviera, tratar un grupo como un documento es exactamente el error
 * original, así que aquí se rinde 1 y no 0.
 */
export const expandirGrupos = (
  grupos: readonly {
    tipo_comprobante: string;
    estado: string;
    _sum?: { monto_total?: unknown };
    _count?: { _all?: number };
  }[],
): { tipoComprobante: string; estado: string; total: number }[] => {
  const filas: { tipoComprobante: string; estado: string; total: number }[] = [];

  for (const grupo of grupos) {
    const cuantos = grupo._count?._all ?? 1;
    if (cuantos <= 0) continue;

    const totalGrupo = Number(grupo._sum?.monto_total ?? 0);
    const totalPorFila = Number.isFinite(totalGrupo) ? totalGrupo / cuantos : 0;

    for (let i = 0; i < cuantos; i += 1) {
      filas.push({
        tipoComprobante: grupo.tipo_comprobante,
        estado: grupo.estado,
        total: totalPorFila,
      });
    }
  }

  return filas;
};

@Injectable()
export class InvoiceMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Métricas del periodo; si no se indica, el mes actual. */
  public async metricas(
    companyId: string,
    periodo?: string,
  ): Promise<MetricasFacturacion> {
    const mes = /^\d{4}-\d{2}$/.test(periodo ?? '')
      ? (periodo as string)
      : periodoActual();

    const { desde, hasta } = rangoDelPeriodo(mes);

    // Se agrupa en la base y no en memoria: una empresa con miles de
    // comprobantes traería la tabla entera a Node para sumar cuatro números.
    //
    // Se pide también `_count` y NO es opcional: `groupBy` devuelve UNA fila por
    // cada combinación distinta de (tipo, estado), no una por comprobante. Sin
    // el conteo, al expandir los grupos se contaba un grupo como si fuera un
    // solo documento y las tarjetas decían "3 aceptados" con 18 en la tabla.
    const grupos = await this.prisma.invoice.groupBy({
      by: ['tipo_comprobante', 'estado'],
      where: {
        company_id: companyId,
        fecha_emision: { gte: desde, lt: hasta },
      },
      _sum: { monto_total: true },
      _count: { _all: true },
    });

    // Se expande cada grupo a tantas filas como comprobantes tenga: así
    // `calcularMetricas` —que recibe documentos, no grupos— sigue siendo una
    // función pura sin estado, y el importe se reparte sin alterar la suma
    // (monto del grupo ÷ nº de comprobantes × nº de comprobantes = monto).
    return calcularMetricas(expandirGrupos(grupos), mes);
  }
}

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

/** Estados que cuentan como "emitido sin rechazo". */
export const ESTADOS_VALIDOS = ['ACEPTADO', 'OBSERVADO', 'EN_COLA', 'ENVIADO', 'PENDIENTE'];

/** Estados que cuentan como pendientes de resolución. */
export const ESTADOS_PENDIENTES = ['EN_COLA', 'ENVIADO', 'PENDIENTE', 'ERROR_RED'];

/** Redondeo monetario a céntimos. */
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

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
    facturadoBruto: r2(facturadoBruto + debitado),
    acreditado: r2(acreditado),
    debitado: r2(debitado),
    facturado: r2(facturadoBruto + debitado - acreditado),
    tasaAceptacion,
    periodo,
  };
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
    const grupos = await this.prisma.invoice.groupBy({
      by: ['tipo_comprobante', 'estado'],
      where: {
        company_id: companyId,
        fecha_emision: { gte: desde, lt: hasta },
      },
      _sum: { monto_total: true },
    });

    return calcularMetricas(
      grupos.map((g) => ({
        tipoComprobante: g.tipo_comprobante,
        estado: g.estado,
        total: Number(g._sum.monto_total ?? 0),
      })),
      mes,
    );
  }
}

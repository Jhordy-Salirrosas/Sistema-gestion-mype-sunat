/**
 * Construcción de las condiciones `where` de Prisma para el listado (TA-29).
 *
 * Se separa del servicio para poder probar los filtros sin base de datos: los
 * rangos de fecha y la búsqueda por serie son justo donde se cuelan los bugs
 * de zona horaria (Lima es UTC-5 y `new Date('2026-10-30')` se interpreta como
 * medianoche UTC, es decir, 7 de la noche del día anterior en Lima).
 */
import { BadRequestException } from '@nestjs/common';
import type { InvoiceStatus } from '../../../../generated/client/enums';
import type { FiltrosComprobantes } from '../dto/invoiceQueryDto';

/** Estados válidos, para rechazar un filtro con un error claro. */
const ESTADOS_VALIDOS: readonly string[] = [
  'PENDIENTE',
  'EN_COLA',
  'PROCESANDO',
  'ENVIADO',
  'ACEPTADO',
  'OBSERVADO',
  'RECHAZADO',
  'ERROR_RED',
  'ANULADO',
];

/** Rango de fechas ya resuelto a instantes, listo para Prisma. */
export interface RangoFechas {
  gte?: Date;
  lte?: Date;
}

/**
 * Convierte una fecha `YYYY-MM-DD` al inicio del día en hora de Perú.
 *
 * Se desplaza a UTC-5 explícitamente en vez de usar `new Date('YYYY-MM-DD')`,
 * que daría medianoche UTC. Con Peru (UTC-5) la diferencia es de 5 horas y
 * basta para que un comprobante emitido a las 20:00 del 29 no aparezca al
 * filtrar el 29 (o aparezca al filtrar el 30).
 */
export function fechaInicioDelDia(iso: string): Date {
  const fecha = instanteValido(iso);
  return fecha;
}

/** Convierte una fecha `YYYY-MM-DD` al último milisegundo de ese día en Perú. */
export function fechaFinDelDia(iso: string): Date {
  const inicio = instanteValido(iso);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Valida el formato y devuelve el instante.
 *
 * Si la cadena no es una fecha ISO alcanza con rechazarla: un filtro mal
 * formado debe responder 400, no devolver silenciosamente todo el listado.
 */
function instanteValido(iso: string): Date {
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const conHora = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/.test(iso);

  if (!soloFecha && !conHora) {
    throw new BadRequestException({
      code: 'INVALID_DATE',
      message: `La fecha '${iso}' no tiene el formato AAAA-MM-DD`,
    });
  }

  // `-05:00` es el desplazamiento de America/Lima (sin horario de verano).
  const fecha = new Date(soloFecha ? `${iso}T00:00:00-05:00` : iso);
  if (Number.isNaN(fecha.getTime())) {
    throw new BadRequestException({
      code: 'INVALID_DATE',
      message: `La fecha '${iso}' no es válida`,
    });
  }
  return fecha;
}

/** Arma el rango de fechas del filtro, o `undefined` si no hay ninguno. */
export function construirRangoFechas(
  filtros: FiltrosComprobantes,
): RangoFechas | undefined {
  if (!filtros.desde && !filtros.hasta) return undefined;

  const rango: RangoFechas = {};
  if (filtros.desde) rango.gte = fechaInicioDelDia(filtros.desde);
  if (filtros.hasta) rango.lte = fechaFinDelDia(filtros.hasta);

  if (rango.gte && rango.lte && rango.gte > rango.lte) {
    throw new BadRequestException({
      code: 'INVALID_DATE_RANGE',
      message: 'La fecha "desde" no puede ser posterior a la fecha "hasta"',
    });
  }

  return rango;
}

/** Objeto `where` de Prisma para el listado. */
export interface WhereComprobantes {
  company_id: string;
  estado?: InvoiceStatus;
  tipo_comprobante?: string;
  serie?: string;
  fecha_emision?: RangoFechas;
}

/**
 * Construye el `where` del listado.
 *
 * `company_id` va SIEMPRE y sale del token, nunca de la query: es lo que
 * impide que una empresa vea comprobantes de otra (criterio 4).
 */
export function construirWhere(
  companyId: string,
  filtros: FiltrosComprobantes,
): WhereComprobantes {
  const where: WhereComprobantes = { company_id: companyId };

  if (filtros.estado) {
    const estado = filtros.estado.toUpperCase();
    if (!ESTADOS_VALIDOS.includes(estado)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `El estado '${filtros.estado}' no existe. Válidos: ${ESTADOS_VALIDOS.join(', ')}`,
      });
    }
    where.estado = estado as InvoiceStatus;
  }

  if (filtros.tipo) {
    where.tipo_comprobante = filtros.tipo.padStart(2, '0');
  }

  if (filtros.serie) {
    // La serie se compara en mayúsculas: la UI la escribe en minúsculas.
    where.serie = filtros.serie.trim().toUpperCase();
  }

  const rango = construirRangoFechas(filtros);
  if (rango) {
    where.fecha_emision = rango;
  }

  return where;
}

/** Página y tamaño normalizados (el límite superior evita un full scan). */
export const PAGE_SIZE_POR_DEFECTO = 20;
export const PAGE_SIZE_MAXIMO = 100;

export function normalizarPaginacion(page?: string, pageSize?: string) {
  const pagina = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const tamanoPedido =
    Number.parseInt(pageSize ?? String(PAGE_SIZE_POR_DEFECTO), 10) ||
    PAGE_SIZE_POR_DEFECTO;

  return {
    page: pagina,
    page_size: Math.min(Math.max(1, tamanoPedido), PAGE_SIZE_MAXIMO),
    skip: (pagina - 1) * Math.min(Math.max(1, tamanoPedido), PAGE_SIZE_MAXIMO),
  };
}

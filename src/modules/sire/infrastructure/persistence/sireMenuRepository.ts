import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/client/client';
import { PrismaService } from '../../../../database/prismaService';
import type { SireEstadoTrabajo } from '../../application/dto/sireMenuResponseDto';
import type { SireLibroMenu } from '../../application/dto/sireMenuQueryDto';

/** Fila del historial unificado que devuelve el JOIN de las tres tablas. */
export interface SireHistorialFilaCruda {
  id: string;
  fecha: Date;
  tipoAccion: string;
  periodo: string;
  estado: string;
  detalle: string | null;
}

/** Datos para crear el registro de una importación. */
export interface CrearImportacionParams {
  companyId: string;
  periodo: string;
  libro: SireLibroMenu;
  nombreArchivo: string;
  messageId: string;
  rutaArchivo: string;
  hashArchivo: string;
  backendAlmacen: string;
  bytes: number;
}

/** Datos para crear el registro de una conciliación. */
export interface CrearConciliacionParams {
  companyId: string;
  periodo: string;
  conciliados: number;
  diferencias: number;
  detalle: unknown;
}

/** Datos para crear el registro de un reporte. */
export interface CrearReporteParams {
  companyId: string;
  periodo: string;
  libro: SireLibroMenu;
  messageId: string;
  ticket: string | null;
}

/**
 * Acceso a las tablas del menú SIRE.
 *
 * Todas las consultas están acotadas por `company_id`: el aislamiento entre
 * empresas se aplica en la base de datos, no en el código que la llama.
 */
@Injectable()
export class SireMenuRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crearImportacion(
    params: CrearImportacionParams,
  ): Promise<{ id: string; created_at: Date }> {
    const registro = await this.prisma.sireImportacion.create({
      data: {
        company_id: params.companyId,
        periodo: params.periodo,
        libro: params.libro,
        nombre_archivo: params.nombreArchivo,
        estado: 'PENDING',
        message_id: params.messageId,
        ruta_archivo: params.rutaArchivo,
        hash_archivo: params.hashArchivo,
        backend_almacen: params.backendAlmacen,
        total_registros: 0,
      },
      select: { id: true, created_at: true },
    });

    return { id: registro.id, created_at: registro.created_at };
  }

  /**
   * Marca la importación como completada.
   *
   * `updateMany` con el estado previo evita que dos trabajadores (una
   * reentrega de la cola, por ejemplo) sobrescriban un resultado ya calculado.
   */
  async completarImportacion(
    id: string,
    totalRegistros: number,
  ): Promise<void> {
    await this.prisma.sireImportacion.updateMany({
      where: { id, estado: { in: ['PENDING', 'PROCESSING'] } },
      data: {
        estado: 'COMPLETED',
        total_registros: totalRegistros,
        error_code: null,
        completed_at: new Date(),
      },
    });
  }

  async marcarImportacionEnProceso(id: string): Promise<void> {
    await this.prisma.sireImportacion.updateMany({
      where: { id, estado: 'PENDING' },
      data: { estado: 'PROCESSING' },
    });
  }

  async fallarImportacion(id: string, errorCode: string): Promise<void> {
    await this.prisma.sireImportacion.updateMany({
      where: { id, estado: { not: 'COMPLETED' } },
      data: {
        estado: 'FAILED',
        error_code: errorCode,
        completed_at: new Date(),
      },
    });
  }

  async buscarImportacionPorMessageId(
    companyId: string,
    messageId: string,
  ): Promise<{
    id: string;
    periodo: string;
    libro: SireLibroMenu;
    nombre_archivo: string;
    estado: SireEstadoTrabajo;
    message_id: string | null;
    ruta_archivo: string | null;
    hash_archivo: string | null;
    backend_almacen: string | null;
    total_registros: number;
    error_code: string | null;
    created_at: Date;
    completed_at: Date | null;
  } | null> {
    return this.prisma.sireImportacion.findFirst({
      where: { company_id: companyId, message_id: messageId },
      select: {
        id: true,
        periodo: true,
        libro: true,
        nombre_archivo: true,
        estado: true,
        message_id: true,
        ruta_archivo: true,
        hash_archivo: true,
        backend_almacen: true,
        total_registros: true,
        error_code: true,
        created_at: true,
        completed_at: true,
      },
    });
  }

  /**
   * Lista las importaciones de un periodo (opcionalmente de un solo libro).
   */
  async listarImportaciones(
    companyId: string,
    periodo?: string,
    libro?: SireLibroMenu,
  ): Promise<
    Array<{
      id: string;
      periodo: string;
      libro: SireLibroMenu;
      nombre_archivo: string;
      estado: SireEstadoTrabajo;
      created_at: Date;
    }>
  > {
    return this.prisma.sireImportacion.findMany({
      where: {
        company_id: companyId,
        ...(periodo ? { periodo } : {}),
        ...(libro ? { libro } : {}),
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        periodo: true,
        libro: true,
        nombre_archivo: true,
        estado: true,
        created_at: true,
      },
    });
  }

  async contarImportaciones(companyId: string, periodo?: string): Promise<number> {
    return this.prisma.sireImportacion.count({
      where: { company_id: companyId, ...(periodo ? { periodo } : {}) },
    });
  }

  async crearConciliacion(
    params: CrearConciliacionParams,
  ): Promise<{ id: string; created_at: Date }> {
    const registro = await this.prisma.sireConciliacion.create({
      data: {
        company_id: params.companyId,
        periodo: params.periodo,
        conciliados: params.conciliados,
        diferencias: params.diferencias,
        detalle: params.detalle as Prisma.InputJsonValue,
      },
      select: { id: true, created_at: true },
    });

    return { id: registro.id, created_at: registro.created_at };
  }

  async contarConciliaciones(companyId: string, periodo?: string): Promise<number> {
    return this.prisma.sireConciliacion.count({
      where: { company_id: companyId, ...(periodo ? { periodo } : {}) },
    });
  }

  async crearReporte(
    params: CrearReporteParams,
  ): Promise<{ id: string; created_at: Date }> {
    const registro = await this.prisma.sireReporte.create({
      data: {
        company_id: params.companyId,
        periodo: params.periodo,
        libro: params.libro,
        estado: 'PENDING',
        message_id: params.messageId,
        ticket: params.ticket,
      },
      select: { id: true, created_at: true },
    });

    return { id: registro.id, created_at: registro.created_at };
  }

  async marcarReporteEnProceso(id: string): Promise<void> {
    await this.prisma.sireReporte.updateMany({
      where: { id, estado: 'PENDING' },
      data: { estado: 'PROCESSING' },
    });
  }

  async completarReporte(id: string, ticket: string): Promise<void> {
    await this.prisma.sireReporte.updateMany({
      where: { id, estado: { in: ['PENDING', 'PROCESSING'] } },
      data: {
        estado: 'COMPLETED',
        ticket,
        error_code: null,
        completed_at: new Date(),
      },
    });
  }

  async fallarReporte(id: string, errorCode: string): Promise<void> {
    await this.prisma.sireReporte.updateMany({
      where: { id, estado: { not: 'COMPLETED' } },
      data: {
        estado: 'FAILED',
        error_code: errorCode,
        completed_at: new Date(),
      },
    });
  }

  async buscarReportePorMessageId(
    companyId: string,
    messageId: string,
  ): Promise<{
    id: string;
    periodo: string;
    libro: SireLibroMenu;
    estado: SireEstadoTrabajo;
    message_id: string | null;
    ticket: string | null;
    error_code: string | null;
    created_at: Date;
    completed_at: Date | null;
  } | null> {
    return this.prisma.sireReporte.findFirst({
      where: { company_id: companyId, message_id: messageId },
      select: {
        id: true,
        periodo: true,
        libro: true,
        estado: true,
        message_id: true,
        ticket: true,
        error_code: true,
        created_at: true,
        completed_at: true,
      },
    });
  }

  async contarReportes(companyId: string, periodo?: string): Promise<number> {
    return this.prisma.sireReporte.count({
      where: { company_id: companyId, ...(periodo ? { periodo } : {}) },
    });
  }

  /**
   * Historial unificado de los tres flujos del menú.
   *
   * Se resuelve con un `UNION ALL` de las tres tablas en una sola consulta: el
   * frontend recibe una lista ordenada por fecha descendente sin tener que
   * combinar los resultados en el cliente.
   *
   * El `INNER JOIN` con `companies` no es decorativo: es el punto donde se
   * aplica el aislamiento por empresa, y permite que el planificador use el
   * índice de la llave foránea.
   */
  async obtenerHistorial(
    companyId: string,
    periodo: string | null,
    limite: number,
  ): Promise<SireHistorialFilaCruda[]> {
    return this.prisma.$queryRaw<SireHistorialFilaCruda[]>(
      Prisma.sql`
        SELECT
          importacion.id AS "id",
          importacion.created_at AS "fecha",
          'IMPORTACION'::text AS "tipoAccion",
          importacion.periodo AS "periodo",
          importacion.estado::text AS "estado",
          importacion.nombre_archivo AS "detalle"
        FROM sire_importaciones AS importacion
        INNER JOIN companies AS empresa
          ON empresa.id = importacion.company_id
        WHERE importacion.company_id = ${companyId}
          AND (${periodo}::text IS NULL OR importacion.periodo = ${periodo})

        UNION ALL

        SELECT
          conciliacion.id AS "id",
          conciliacion.created_at AS "fecha",
          'CONCILIACION'::text AS "tipoAccion",
          conciliacion.periodo AS "periodo",
          'CONCILIADO'::text AS "estado",
          NULL::text AS "detalle"
        FROM sire_conciliaciones AS conciliacion
        INNER JOIN companies AS empresa
          ON empresa.id = conciliacion.company_id
        WHERE conciliacion.company_id = ${companyId}
          AND (${periodo}::text IS NULL OR conciliacion.periodo = ${periodo})

        UNION ALL

        SELECT
          reporte.id AS "id",
          reporte.created_at AS "fecha",
          'REPORTE'::text AS "tipoAccion",
          reporte.periodo AS "periodo",
          reporte.estado::text AS "estado",
          reporte.ticket AS "detalle"
        FROM sire_reportes AS reporte
        INNER JOIN companies AS empresa
          ON empresa.id = reporte.company_id
        WHERE reporte.company_id = ${companyId}
          AND (${periodo}::text IS NULL OR reporte.periodo = ${periodo})

        ORDER BY "fecha" DESC
        LIMIT ${limite}
      `,
    );
  }
}

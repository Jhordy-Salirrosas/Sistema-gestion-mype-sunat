/**
 * Reserva atómica del correlativo sobre `invoice_series` (TA-60).
 *
 * El defecto que corrige este archivo: la tabla `invoice_series` existía con la
 * columna `current_correlative` desde el Sprint 1, pero NINGÚN archivo de `src`
 * la usaba. El correlativo llegaba desde el DTO, así que era el navegador quien
 * decidía el número. Con dos cajas emitiendo a la vez eso produce dos cosas:
 *
 *  - dos facturas con el mismo F001-00000012, y la segunda la rechaza SUNAT por
 *    duplicidad (1032/1033) después de haber gastado el envío;
 *  - huecos silenciosos cuando alguien retrocede en el formulario.
 *
 * La solución es una sola sentencia `UPDATE ... RETURNING`. Lo importante NO es
 * que sea `$queryRaw` sino que el incremento y la lectura del nuevo valor sean
 * una única operación atómica: dos transacciones simultáneas se serializan en la
 * fila y cada una recibe un número distinto. Hacer `findUnique` y luego `update`
 * deja una ventana entre la lectura y la escritura donde ambas leen el mismo
 * `current_correlative` (condición de carrera clásica de lectura-modificación).
 *
 * Decisión sobre los números "quemados": el comentario del backlog habla de no
 * reutilizar correlativos quemados por un rechazo de SUNAT (2000-3999). Aquí NO
 * se reutilizan nunca, porque el número ya se consumió al reservarlo y un
 * rechazo de SUNAT no devuelve ese número a la serie. Devolverlo generaría dos
 * comprobantes con el mismo número, y SUNAT relaciona el rechazo con el número:
 * reutilizarlo hace que el comprobante nuevo herede el historial del rechazado.
 */
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../../../generated/client/client';
import { PrismaService } from '../../../../database/prismaService';

export const MAXIMO_CORRELATIVO = 99999999;
export function validarSerieNoAgotada(actual: number): void {
  if (actual >= MAXIMO_CORRELATIVO) throw new ConflictException({
    code: 'SERIE_AGOTADA', message: 'SERIE_AGOTADA: se alcanzó el correlativo máximo de ocho dígitos; configure otra serie',
  });
}

/** Una serie de la empresa, tal como la expone la API. */
export interface SerieFiscal {
  id: string;
  document_type: string;
  series: string;
  current_correlative: number;
  is_active: boolean;
}

/** Datos para crear o dar de alta una serie. */
export interface AltaSerieParams {
  companyId: string;
  documentType: string;
  series: string;
  /** Último número ya usado antes de usar el sistema; por defecto 0. */
  correlativoInicial?: number;
}

/**
 * El correlativo no se puede reservar.
 *
 * Se lanza en dos situaciones que el cliente tiene que distinguir:
 *  - la serie no está configurada para esa empresa → 404, hay que crearla;
 *  - la serie está dada de baja → 409, hay que reactivarla.
 * Devolver un número en cualquiera de los dos casos rompería la garantía.
 */
export class SerieNoDisponibleError extends Error {
  constructor(
    message: string,
    readonly motivo: 'NO_EXISTE' | 'INACTIVA',
  ) {
    super(message);
    this.name = 'SerieNoDisponibleError';
  }
}

@Injectable()
export class InvoiceSeriesService {
  private readonly logger = new Logger(InvoiceSeriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserva y devuelve el siguiente correlativo de una serie.
   *
   * ATÓMICO: el `UPDATE` y el `RETURNING` son la misma sentencia, así que el
   * motor de base de datos bloquea la fila y ninguna otra transacción puede
   * leer el mismo número. `is_active = true` va DENTRO del `WHERE`: si la serie
   * está de baja, el `UPDATE` no afecta filas y no se consume ningún número.
   *
   * @throws SerieNoDisponibleError si la serie no existe o está inactiva.
   */
  async reservarCorrelativo(
    companyId: string,
    documentType: string,
    series: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const cliente = tx ?? this.prisma;
    const tipo = documentType.trim().padStart(2, '0');
    const serie = series.trim().toUpperCase();

    // Se usa $queryRawTipado en lugar de $queryRaw para tipar el resultado.
    // `Prisma.sql` escapa cada parámetro: no hay concatenación de cadenas, así
    // que un `series` malicioso no puede inyectar SQL.
    const filas = await cliente.$queryRaw<Array<{ current_correlative: number }>>(
      Prisma.sql`
        UPDATE invoice_series
           SET current_correlative = current_correlative + 1,
               updated_at = NOW()
         WHERE company_id = ${companyId}
           AND document_type = ${tipo}
           AND series = ${serie}
           AND is_active = true
           AND current_correlative < 99999999
        RETURNING current_correlative
      `,
    );

    const reservado = filas[0]?.current_correlative;
    if (reservado === undefined) {
      // No se pudo incrementar: o no existe o está inactiva. Se distingue para
      // que el usuario reciba una acción concreta y no un 404 genérico.
      throw await this.motivoDeFallo(companyId, tipo, serie);
    }

    this.logger.log(
      `[TA-60] Serie ${tipo}-${serie} reservó el correlativo ${reservado}`,
    );
    return reservado;
  }

  /** Diferencia "no existe" de "está dada de baja" para el mensaje de error. */
  private async motivoDeFallo(
    companyId: string,
    documentType: string,
    series: string,
  ): Promise<SerieNoDisponibleError | ConflictException> {
    const existente = await this.prisma.invoiceSeries.findUnique({
      where: {
        company_id_document_type_series: {
          company_id: companyId,
          document_type: documentType,
          series,
        },
      },
      select: { is_active: true, current_correlative: true },
    });

    if (!existente) {
      return new SerieNoDisponibleError(
        `La serie ${documentType}-${series} no está configurada para la empresa`,
        'NO_EXISTE',
      );
    }

    if (existente.is_active) {
      validarSerieNoAgotada(existente.current_correlative);
    }
    return new SerieNoDisponibleError(
      `La serie ${documentType}-${series} está dada de baja: reactívela antes de emitir`,
      'INACTIVA',
    );
  }

  /**
   * Crea la serie o, si ya existe, la reactiva.
   *
   * Es `upsert` a propósito: el usuario que vuelve a dar de alta una serie que
   * dio de baja espera que funcione, no un error de clave duplicada (P2002).
   * El `current_correlative` NO se reinicia al reactivar: reutilizar números ya
   * quemados es justo lo que hay que evitar.
   */
  async asegurarSerie(params: AltaSerieParams): Promise<SerieFiscal> {
    const tipo = params.documentType.trim().padStart(2, '0');
    const serie = params.series.trim().toUpperCase();
    const inicial = params.correlativoInicial ?? 0;
    if (!Number.isInteger(inicial) || inicial < 0 || inicial > MAXIMO_CORRELATIVO) {
      throw new BadRequestException('correlativo_inicial debe ser un entero entre 0 y 99999999');
    }

    return this.prisma.invoiceSeries.upsert({
      where: {
        company_id_document_type_series: {
          company_id: params.companyId,
          document_type: tipo,
          series: serie,
        },
      },
      create: {
        company_id: params.companyId,
        document_type: tipo,
        series: serie,
        current_correlative: inicial,
        is_active: true,
      },
      update: {
        is_active: true,
      },
      select: {
        id: true,
        document_type: true,
        series: true,
        current_correlative: true,
        is_active: true,
      },
    });
  }

  /** Series de la empresa, ordenadas por tipo y serie. */
  async listar(companyId: string): Promise<SerieFiscal[]> {
    return this.prisma.invoiceSeries.findMany({
      where: { company_id: companyId },
      orderBy: [{ document_type: 'asc' }, { series: 'asc' }],
      select: {
        id: true,
        document_type: true,
        series: true,
        current_correlative: true,
        is_active: true,
      },
    });
  }
}

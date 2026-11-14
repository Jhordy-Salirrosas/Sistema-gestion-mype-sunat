import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { InvoiceBridgeCoordinatorService } from './invoiceBridgeCoordinatorService';

/**
 * Regularización de comprobantes aceptados que se quedaron sin asiento.
 *
 * La auditoría contable (`GET /accounting/audit`) identifica los pendientes;
 * este servicio los reintenta. No inventa nada: vuelve a ejecutar el mismo
 * puente contable que corrió al emitir, que ya es idempotente por
 * `idempotency_key` y por `source_reference_id`, así que reprocesar un
 * comprobante que sí tiene asiento no lo duplica.
 *
 * Por defecto trabaja en seco (`dryRun`): dice qué haría sin tocar nada. Es la
 * única forma de correrlo sobre producción sin respaldo reciente.
 */

export interface RegularizationOptions {
  dryRun?: boolean;
  /** Tope de comprobantes a revisar. Se recorta a 500. */
  limit?: number;
  /** IDs concretos, tal como los devolvió la auditoría. */
  ids?: string[];
}

export interface RegularizationFinding {
  id: string;
  numero: string;
  tipoComprobante: string;
}

export interface RegularizationFailure extends RegularizationFinding {
  motivo: string;
}

export interface RegularizationResult {
  dryRun: boolean;
  revisados: number;
  pendientes: number;
  regularizados: number;
  omitidos: number;
  fallidos: RegularizationFailure[];
  /** Pendientes detectados (en seco, los que se intentarían). */
  detalle: RegularizationFinding[];
}

const LIMITE_MAXIMO = 500;
const numeroDe = (serie: string, correlativo: number): string =>
  `${serie}-${String(correlativo).padStart(8, '0')}`;

@Injectable()
export class AccountingRegularizationService {
  private readonly logger = new Logger(AccountingRegularizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puente: InvoiceBridgeCoordinatorService,
  ) {}

  async execute(companyId: string, opciones: RegularizationOptions = {}): Promise<RegularizationResult> {
    const limit = this.normalizarLimite(opciones.limit);
    const dryRun = opciones.dryRun !== false;

    if (opciones.ids?.length && opciones.ids.length > LIMITE_MAXIMO) {
      throw new BadRequestException(`No se pueden regularizar más de ${LIMITE_MAXIMO} comprobantes por lote.`);
    }

    const comprobantes = await this.prisma.invoice.findMany({
      where: {
        company_id: companyId,
        estado: 'ACEPTADO',
        tipo_comprobante: { in: ['01', '03'] },
        ...(opciones.ids?.length ? { id: { in: opciones.ids } } : {}),
      },
      select: { id: true, serie: true, correlativo: true, tipo_comprobante: true },
      orderBy: [{ fecha_emision: 'asc' }, { correlativo: 'asc' }],
      take: limit,
    });

    if (comprobantes.length === 0) {
      return { dryRun, revisados: 0, pendientes: 0, regularizados: 0, omitidos: 0, fallidos: [], detalle: [] };
    }

    const numeros = comprobantes.map((c) => numeroDe(c.serie, c.correlativo));
    const referencias = [...comprobantes.map((c) => c.id), ...numeros];
    const existentes = await this.prisma.accountingEntry.findMany({
      where: { company_id: companyId, source_reference_id: { in: referencias } },
      select: { source_reference_id: true },
    });
    const conAsiento = new Set(existentes.map((e) => e.source_reference_id).filter(Boolean));

    const pendientes = comprobantes.filter(
      (c) => !conAsiento.has(c.id) && !conAsiento.has(numeroDe(c.serie, c.correlativo)),
    );
    const detalle: RegularizationFinding[] = pendientes.map((c) => ({
      id: c.id,
      numero: numeroDe(c.serie, c.correlativo),
      tipoComprobante: c.tipo_comprobante,
    }));

    if (dryRun) {
      return {
        dryRun: true,
        revisados: comprobantes.length,
        pendientes: pendientes.length,
        regularizados: 0,
        omitidos: 0,
        fallidos: [],
        detalle,
      };
    }

    let regularizados = 0;
    let omitidos = 0;
    const fallidos: RegularizationFailure[] = [];

    for (const comprobante of pendientes) {
      const numero = numeroDe(comprobante.serie, comprobante.correlativo);
      try {
        const resultado = await this.puente.reprocesar(companyId, comprobante.id);
        if (resultado.asientoId && !resultado.asientoOmitido) {
          regularizados += 1;
        } else if (resultado.asientoOmitido) {
          omitidos += 1;
        } else {
          fallidos.push({
            id: comprobante.id,
            numero,
            tipoComprobante: comprobante.tipo_comprobante,
            motivo: resultado.errores.join(' | ') || 'el puente no generó asiento',
          });
        }
      } catch (error) {
        // Un comprobante que falla no debe detener el lote: se informa y sigue.
        const motivo = (error as Error).message;
        this.logger.warn(`Regularización ${numero}: ${motivo}`);
        fallidos.push({ id: comprobante.id, numero, tipoComprobante: comprobante.tipo_comprobante, motivo });
      }
    }

    return {
      dryRun: false,
      revisados: comprobantes.length,
      pendientes: pendientes.length,
      regularizados,
      omitidos,
      fallidos,
      detalle,
    };
  }

  private normalizarLimite(limit?: number): number {
    const valor = Number(limit ?? 50);
    if (!Number.isFinite(valor) || valor <= 0) return 50;
    return Math.min(Math.floor(valor), LIMITE_MAXIMO);
  }
}

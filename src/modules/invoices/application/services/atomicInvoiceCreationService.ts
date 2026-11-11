import { validarContenidoFiscal } from '../../validateInvoiceContent';
import { traducirEmision } from './emitirComprobanteAdapter';
import { validarReservaVenta } from './invoiceStockReservation';
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../../database/prismaService';
import { Prisma } from '../../../../generated/client/client';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import { PrismaInvoiceRepository } from '../../infrastructure/persistence/prismaInvoiceRepository';
import { fiscalToEmission, prepareCreation } from './creationGuards';
import { CreateInvoiceDto } from '../dto/createInvoiceDto';
import { EmitirComprobanteDto } from '../dto/emitirComprobanteDto';
import { EmitirComprobanteService, type ResultadoEmision } from './emitirComprobanteService';
import { InvoiceSeriesService } from './invoiceSeriesService';
import { InvoiceNoteService } from './invoiceNoteService';
import { StockValidationService } from './stockValidationService';
import type { InvoicePersistenceResult } from '../../domain/ports/invoiceRepositoryPort';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]),
  );
  return value;
}

/** Límite transaccional de AMBAS rutas HTTP. No abre conexiones a SUNAT. */
@Injectable()
export class AtomicInvoiceCreationService {
  constructor(private readonly prisma: PrismaService, private readonly queue: QueueService) {}

  create(dto: CreateInvoiceDto, companyId: string, key?: string): Promise<InvoicePersistenceResult> {
    return this.execute('fiscal', dto, companyId, key, async (tx) => {
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { ruc: true } });
      if (!company || company.ruc !== dto.ruc_emisor) throw new BadRequestException('ISSUER_IDENTITY_MISMATCH');
      const result = await this.runEmission(tx, fiscalToEmission(dto), companyId);
      if (result.monto_total !== dto.monto_total) throw new BadRequestException('El total fiscal no coincide con la liquidación del servidor');
      const created = await tx.invoice.findUniqueOrThrow({ where: { id: result.id },
        select: { id: true, estado: true, created_at: true } });
      return created;
    });
  }

  emitir(dto: EmitirComprobanteDto, companyId: string, key?: string): Promise<ResultadoEmision> {
    return this.execute('pantalla', dto, companyId, key, (tx) => this.runEmission(tx, dto, companyId));
  }

  private async runEmission(tx: Prisma.TransactionClient, dto: EmitirComprobanteDto, companyId: string) {
    const validated = await prepareCreation(tx, dto, companyId);
    await validarReservaVenta(tx, validated, companyId);
    const scoped = tx as unknown as PrismaService;
    const service = new EmitirComprobanteService(scoped, new InvoiceSeriesService(scoped),
      new StockValidationService(scoped), new InvoiceNoteService(scoped),
      new PrismaInvoiceRepository(this.prisma, this.queue).inTransaction(tx),
    );
    const emisor = await service.datosDelEmisor(companyId);
    validarContenidoFiscal(traducirEmision(validated, emisor, 0).dto.payload_ubl as never);
    return service.emitir(validated, companyId);
  }

  private async execute<T>(route: string, dto: unknown, companyId: string, key: string | undefined,
    work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (!companyId) throw new ForbiddenException('ISSUER_COMPANY_REQUIRED');
    if (!key || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
      throw new BadRequestException('Idempotency-Key obligatorio: de 16 a 128 caracteres alfanuméricos, guion o guion bajo. Reutilice la misma clave al reintentar.');
    }
    const fingerprint = createHash('sha256').update(JSON.stringify(canonical({ route, dto }))).digest('hex');
    return this.prisma.$transaction(async (tx) => {
      // Bloqueo entre procesos; incluye tenant y se libera en commit/rollback.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${companyId + ':' + key}, 0))`;
      const previous = await tx.invoiceCreationRequest.findUnique({
        where: { company_id_request_key: { company_id: companyId, request_key: key } },
      });
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new ConflictException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY');
        return previous.response as T;
      }
      const result = await work(tx);
      await tx.invoiceCreationRequest.create({ data: {
        company_id: companyId, request_key: key, fingerprint,
        response: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
      } });
      return result;
    }, { timeout: 15000 });
  }
}

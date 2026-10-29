/**
 * Dobles y utilidades compartidas de TA-34.
 *
 * La BD y pg-boss se simulan en memoria; los servicios de resiliencia
 * (`InvoiceRetryService`, `SunatBillService`, `InvoiceDlqService` y
 * `CdrPersistenceService`) son los reales.
 */
import { Logger } from '@nestjs/common';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { PrismaService } from '../../../src/database/prismaService';
import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';
import { InvoiceDlqService } from '../../../src/modules/resilience/infrastructure/queue/invoiceDlqService';
import {
  InvoiceRetryService,
  type SleepFn,
} from '../../../src/modules/resilience/infrastructure/queue/invoiceRetryService';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { CdrPersistenceService } from '../../../src/modules/sunat/cdr-persistence.service';
import { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import type { SunatSoapClient } from '../../../src/modules/sunat/soap/sunat-soap.client';
import type {
  ProcessCdrResult,
  SendInvoiceParams,
} from '../../../src/modules/sunat/soap/sunatBillTypes';

export interface HistoryRow {
  invoice_id: string;
  intento: number;
  estado_anterior: InvoiceStatus | null;
  estado_nuevo: InvoiceStatus;
  codigo_error: string | null;
  mensaje_error: string | null;
  tiempo_respuesta_ms: number | null;
}

export interface FakeDb {
  invoices: Map<string, { estado: InvoiceStatus }>;
  history: HistoryRow[];
  prisma: { $transaction: jest.Mock };
  tx: {
    invoice: { update: jest.Mock };
    transactionHistory: { create: jest.Mock };
  };
}

export const BASE: SendInvoiceParams = {
  invoiceId: 'inv-ta34-001',
  rucEmisor: '20123456786',
  tipoComprobante: '01',
  serie: 'F001',
  correlativo: 1,
  zip: Buffer.from('zip-ta34'),
  estadoActual: InvoiceStatus.PROCESANDO,
};

export function crearDb(invoiceId: string): FakeDb {
  const invoices = new Map<string, { estado: InvoiceStatus }>([
    [invoiceId, { estado: InvoiceStatus.PROCESANDO }],
  ]);
  const history: HistoryRow[] = [];

  const tx = {
    invoice: {
      update: jest.fn(
        async (args: { where: { id: string }; data: { estado: InvoiceStatus } }) => {
          const actual = invoices.get(args.where.id);
          if (actual) actual.estado = args.data.estado;
          return { id: args.where.id, estado: args.data.estado };
        },
      ),
    },
    transactionHistory: {
      create: jest.fn(async (args: { data: HistoryRow }) => {
        history.push(args.data);
        return args.data;
      }),
    },
  };

  return {
    invoices,
    history,
    tx,
    prisma: {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    },
  };
}

export function crearPersistencia(db: FakeDb): CdrPersistenceService {
  return new CdrPersistenceService(db.prisma as unknown as PrismaService);
}

export function crearRetry(params: {
  db: FakeDb;
  persistence: CdrPersistenceService;
  soap: SunatSoapClient;
  queue: { sendToDlq: jest.Mock };
  state: ResilienceStateService;
  sleep: SleepFn;
  sunatBill?: SunatBillService;
}): InvoiceRetryService {
  const dlq = new InvoiceDlqService(
    params.db.prisma as unknown as PrismaService,
    params.queue as unknown as QueueService,
  );
  const sunat =
    params.sunatBill ??
    new SunatBillService(params.persistence, params.soap);
  return new InvoiceRetryService(dlq, sunat, params.state, params.sleep);
}

export function aceptado(): ProcessCdrResult {
  return {
    invoiceId: BASE.invoiceId,
    responseCode: '0',
    estado: InvoiceStatus.ACEPTADO,
    valido: true,
    reintentable: false,
    clasificacion: {
      status: InvoiceStatus.ACEPTADO,
      kind: 'ACEPTADO',
      valido: true,
      reintentable: false,
    },
    cdr: null,
    tiempoRespuestaMs: 10,
    error: null,
  };
}

export function silenciarLogger(): void {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
}

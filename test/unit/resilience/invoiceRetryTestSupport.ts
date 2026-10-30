/**
 * Dobles compartidos de las pruebas de HU-04.
 *
 * Mantiene los specs por debajo del límite de líneas del proyecto y evita
 * repetir el mock de Prisma, la cola y el reloj en cada caso.
 */
import { Logger } from '@nestjs/common';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { PrismaService } from '../../../src/database/prismaService';
import { InvoiceRetryService } from '../../../src/modules/resilience/infrastructure/queue/invoiceRetryService';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import type {
  ProcessCdrResult,
  SendInvoiceParams,
} from '../../../src/modules/sunat/soap/sunatBillTypes';

export const paramsBase: SendInvoiceParams = {
  invoiceId: 'inv-hu04-001',
  rucEmisor: '20123456786',
  tipoComprobante: '01',
  serie: 'F001',
  correlativo: 1,
  zip: Buffer.from('zip-simulado'),
  estadoActual: InvoiceStatus.PROCESANDO,
};

export function falloDeRed(): ProcessCdrResult {
  return {
    invoiceId: paramsBase.invoiceId,
    responseCode: '',
    estado: InvoiceStatus.ENVIADO,
    valido: false,
    reintentable: true,
    clasificacion: {
      status: InvoiceStatus.ENVIADO,
      kind: 'VACIO',
      valido: false,
      reintentable: true,
    },
    cdr: null,
    tiempoRespuestaMs: null,
    error: 'Timeout simulado',
  };
}

export function rechazoDeNegocio(): ProcessCdrResult {
  return {
    invoiceId: paramsBase.invoiceId,
    responseCode: '2326',
    estado: InvoiceStatus.RECHAZADO,
    valido: false,
    reintentable: false,
    clasificacion: {
      status: InvoiceStatus.RECHAZADO,
      kind: 'RECHAZADO',
      valido: false,
      reintentable: false,
    },
    cdr: null,
    tiempoRespuestaMs: 120,
    error: 'El comprobante fue rechazado por SUNAT',
  };
}

export function aceptado(): ProcessCdrResult {
  return {
    invoiceId: paramsBase.invoiceId,
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
    tiempoRespuestaMs: 90,
    error: null,
  };
}

export function silenciarLogger(): void {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
}

export interface Dobles {
  prisma: { $transaction: jest.Mock };
  tx: {
    invoice: { update: jest.Mock };
    transactionHistory: { create: jest.Mock };
  };
  queue: { sendToDlq: jest.Mock };
  sleep: jest.Mock;
  crearServicio: (sunat: SunatBillService) => InvoiceRetryService;
}

export function crearDobles(): Dobles {
  const tx = {
    invoice: {
      update: jest.fn().mockResolvedValue({ company_id: 'company-test' }),
    },
    transactionHistory: { create: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };

  const queue = { sendToDlq: jest.fn().mockResolvedValue('dlq-job-1') };
  const sleep = jest.fn().mockResolvedValue(undefined);

  return {
    prisma,
    tx,
    queue,
    sleep,
    crearServicio: (sunat: SunatBillService) =>
      new InvoiceRetryService(
        prisma as unknown as PrismaService,
        queue as unknown as QueueService,
        sunat,
        sleep,
      ),
  };
}

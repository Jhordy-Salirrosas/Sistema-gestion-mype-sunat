import { ServiceUnavailableException } from '@nestjs/common';
import type { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import type { WhereComprobantes } from './invoiceQueryFilters';

/** Misma fuente que alertas: jobs vigentes de DLQ de la empresa, nunca historial. */
export async function leerIdsDlq(cola: Pick<QueueService, 'listDlq'>, companyId: string): Promise<Set<string> | null> {
  try {
    const jobs = await cola.listDlq(companyId);
    return new Set(jobs.map(job => job.comprobanteSerieNumero).filter((id): id is string => typeof id === 'string' && id !== 'sin identificar'));
  } catch {
    // Las consultas fiscales siguen disponibles; null informa que la membresía es desconocida.
    return null;
  }
}

/** Filtra antes de paginar y contar; no excluye documentos con estado final. */
export function filtrarDlq(where: WhereComprobantes, filtro: string | undefined, ids: Set<string> | null): WhereComprobantes {
  if (filtro === undefined) return where;
  if (ids === null) throw new ServiceUnavailableException({ code: 'DLQ_NO_DISPONIBLE', message: 'No se pudo consultar la membresía de la cola de muertos. Intente nuevamente.' });
  return { ...where, id: filtro === 'true' ? { in: [...ids] } : { notIn: [...ids] } };
}

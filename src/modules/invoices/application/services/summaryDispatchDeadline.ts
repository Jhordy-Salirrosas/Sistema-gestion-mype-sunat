import { fechaFiscalLima } from '../../fiscalDate';
import type { InvoiceAggregate } from '../../../../generated/client/client';
import type { PrismaService } from '../../../../database/prismaService';
import { diasDesdeEmision } from './summaryDocumentsBuilder';

/** Solo antes del primer envío: nunca impide consultar un ticket existente. */
export async function validarPlazoDespachoRa(db: PrismaService, row: InvoiceAggregate): Promise<void> {
  const members = row.members as unknown as { id: string }[];
  const ids = [...new Set(members.map(m => m.id))];
  const docs = await db.invoice.findMany({ where: { company_id: row.company_id, id: { in: ids } }, select: { id: true, fecha_emision: true } });
  if (!ids.length || docs.length !== ids.length) throw new Error('RA_DESPACHO_MIEMBROS_INCOMPLETOS: no se acredita la fecha de todos los miembros');
  const hoy = fechaFiscalLima();
  for (const doc of docs) {
    const fecha = doc.fecha_emision.toISOString().slice(0, 10);
    const dias = diasDesdeEmision(fecha, hoy);
    if (dias === null || dias < 0 || dias > 7) throw new Error(`RA_DESPACHO_FUERA_DE_PLAZO: ${doc.id}, emisión ${fecha}, despacho ${hoy}; regla 2957, máximo 7 días. Agregado no enviado.`);
  }
}

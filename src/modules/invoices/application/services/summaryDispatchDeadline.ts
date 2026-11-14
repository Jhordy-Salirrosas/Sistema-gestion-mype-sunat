import { esAnulacionRc, validarNotaAnulacionRc } from './summaryCancellation';
import { fechaFiscalLima } from '../../fiscalDate';
import type { InvoiceAggregate } from '../../../../generated/client/client';
import type { PrismaService } from '../../../../database/prismaService';
import { diasDesdeEmision, vaEnBaja } from './summaryDocumentsBuilder';

/** Solo antes del primer envío: nunca impide consultar un ticket existente. */
export async function validarPlazoDespachoRa(db: PrismaService, row: InvoiceAggregate): Promise<void> {
  const members = row.members as unknown as { id: string; acceptedDate?: string }[];
  const ids = [...new Set(members.map(m => m.id))];
  const docs = await db.invoice.findMany({ where: { company_id: row.company_id, id: { in: ids } }, select: { id: true, fecha_emision: true, tipo_comprobante: true, serie: true, referenced_series_correlative: true, referenced_document_type: true, estado: true } });
  if (!ids.length || docs.length !== ids.length) throw new Error('RA_DESPACHO_MIEMBROS_INCOMPLETOS: no se acredita la fecha de todos los miembros');
  const hoy = fechaFiscalLima();
  for (const doc of docs) {
    if (row.kind === 'RC' && esAnulacionRc(row.members)) {
      validarNotaAnulacionRc({ tipoComprobante: doc.tipo_comprobante, serie: doc.serie, estado: doc.estado,
        fechaEmision: doc.fecha_emision.toISOString().slice(0, 10), documentoAfectado: doc.referenced_series_correlative ?? undefined, tipoDocumentoAfectado: doc.referenced_document_type,
        fechaAceptacion: members.find(m => m.id === doc.id)?.acceptedDate }, hoy);
      continue;
    }
    if (!vaEnBaja({ tipoComprobante: doc.tipo_comprobante, serie: doc.serie,
      documentoAfectado: doc.referenced_series_correlative ?? undefined,
      tipoDocumentoAfectado: doc.referenced_document_type })) {
      throw new Error(`RA_DESPACHO_TIPO_INVALIDO: ${doc.id}; las notas de boleta se anulan mediante RC. Agregado no enviado.`);
    }
    const fecha = doc.fecha_emision.toISOString().slice(0, 10);
    const dias = diasDesdeEmision(fecha, hoy);
    if (dias === null || dias < 0 || dias > 7) throw new Error(`RA_DESPACHO_FUERA_DE_PLAZO: ${doc.id}, emisión ${fecha}, despacho ${hoy}; regla 2957, máximo 7 días. Agregado no enviado.`);
  }
}

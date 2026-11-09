import type { ParsedCdr } from './cdr.parser';

export class CdrReferenceMismatch extends Error {
  constructor() { super('CDR_REFERENCE_MISMATCH: la constancia no corresponde al comprobante consultado/enviado'); }
}

/** No inventa una referencia ausente ni aplica el CDR a otro documento. */
export function assertCdrReference(cdr: Pick<ParsedCdr, 'referenceId'>,
  invoice: { serie: string; correlativo: number }): void {
  const reference = /^([A-Za-z0-9]{4})-(\d{1,8})$/.exec(cdr.referenceId?.trim() ?? '');
  if (!reference || reference[1].toUpperCase() !== invoice.serie.toUpperCase() ||
    Number(reference[2]) !== invoice.correlativo) throw new CdrReferenceMismatch();
}

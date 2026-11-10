import { Injectable } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
import type { IssuerContext } from '../../../sunat/issuerConfigResolver';
import { endpointCoherente } from '../../../sunat/soap/sunatBillTypes';
import { ejecutarSfs } from './sunatSfsRunner';

export type AggregateKind = 'RA' | 'RC';
export const hashSummary = (xml: string) => createHash('sha256').update(xml).digest('hex');
/** Misma barra en preparación y worker; MOCK nunca autoriza destino externo. */
@Injectable()
export class SummaryGate {
  async validar(xml: string, kind: AggregateKind, context: IssuerContext, identifier: string): Promise<void> {
    if (!['MOCK', 'BETA', 'PRODUCCION'].includes(context.environment ?? '') || !endpointCoherente(context.environment, context.endpoint)) throw new Error('SUMMARY_ENDPOINT_ENV_MISMATCH');
    if (context.environment !== 'MOCK' && !context.sol) throw new Error('SUMMARY_SOL_REQUIRED');
    if (XMLValidator.validate(xml) !== true || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('SUMMARY_XML_INVALID');
    const parsed = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false }).parse(xml);
    const root = parsed[kind === 'RA' ? 'VoidedDocuments' : 'SummaryDocuments'];
    if (!root || root.ID !== identifier || String(root.AccountingSupplierParty?.CustomerAssignedAccountID) !== context.ruc) throw new Error('SUMMARY_IDENTITY_MISMATCH');
    if (!root.UBLExtensions?.UBLExtension?.ExtensionContent?.Signature?.SignedInfo) throw new Error('SUMMARY_SIGNATURE_REQUIRED');
    const result = await ejecutarSfs(xml, kind);
    if (!result.completado || result.errores.length) throw new Error(`SUMMARY_VALIDATION_BLOCKED: ${result.errores.map(e => `${e.codigo}: ${e.mensaje}`).join(' | ')}`);
  }
}

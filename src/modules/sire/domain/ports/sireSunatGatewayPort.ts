import type { SireDomainBookType } from '../../application/sireBookType';
import type { SireProposalEntity } from '../entities/sireProposalEntity';

export const SIRE_SUNAT_GATEWAY = Symbol('SIRE_SUNAT_GATEWAY');

/**
 * Puerta de salida hacia SUNAT.
 *
 * SIRE es ESTRICTAMENTE DE SOLO LECTURA: este puerto solo expone consultas.
 * Las operaciones que antes aceptaban, reemplazaban, cerraban o enviaban
 * libros a SUNAT se eliminaron a propósito para que no exista forma de
 * emitir nada desde este módulo.
 */
export interface SireSunatGatewayPort {
  getProposal(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
  ): Promise<SireProposalEntity[]>;
}

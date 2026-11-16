import { SessionMembershipService } from '../../src/modules/auth/application/services/sessionMembershipService';
/** Aísla pertenencia en tests de transporte/negocio. Los tests de sessionMembership
 * y rolesAdministrables.http ejecutan el servicio real para cambios y empresas. */
export const sessionMembershipTestProvider={provide:SessionMembershipService,useValue:{resolve:jest.fn(async payload=>payload)}};

import type { SireSunatGatewayPort } from '../../domain/ports/sireSunatGatewayPort';

export function selectSireSunatGateway(
  sireEnvironment: string | undefined,
  nodeEnvironment: string | undefined,
  mockGateway: SireSunatGatewayPort,
  unsupportedGateway: SireSunatGatewayPort,
): SireSunatGatewayPort {
  return sireEnvironment?.toLowerCase() === 'mock' &&
    nodeEnvironment?.toLowerCase() !== 'production'
    ? mockGateway
    : unsupportedGateway;
}

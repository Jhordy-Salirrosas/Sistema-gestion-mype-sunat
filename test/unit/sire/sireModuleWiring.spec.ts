import { MODULE_METADATA } from '@nestjs/common/constants';
import { SireModule } from '../../../src/modules/sire/sireModule';
import { SIRE_CONFIGURATION_REPOSITORY_PORT } from '../../../src/modules/sire/domain/ports/sireConfigurationRepositoryPort';
import { SireConfigurationController } from '../../../src/modules/sire/infrastructure/controllers/sireConfigurationController';
import { PrismaSireConfigurationRepository } from '../../../src/modules/sire/infrastructure/persistence/prismaSireConfigurationRepository';
import { GuardarConfiguracionSireUseCase } from '../../../src/modules/sire/application/use-cases/guardarConfiguracionSireUseCase';
import { ConsultarEstadoConfiguracionSireUseCase } from '../../../src/modules/sire/application/use-cases/consultarEstadoConfiguracionSireUseCase';
import { SireMenuController } from '../../../src/modules/sire/infrastructure/controllers/sireMenuController';
import { SireReadOnlyPeriodsController } from '../../../src/modules/sire/infrastructure/controllers/sireReadOnlyPeriodsController';

describe('SireModule', () => {
  const controllers = Reflect.getMetadata(
    MODULE_METADATA.CONTROLLERS,
    SireModule,
  ) as unknown[];
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    SireModule,
  ) as unknown[];

  it('registers the SIRE controllers', () => {
    expect(controllers).toEqual(
      expect.arrayContaining([
        SireConfigurationController,
        SireMenuController,
        SireReadOnlyPeriodsController,
      ]),
    );
  });

  it('registers the use cases of the SIRE configuration', () => {
    expect(providers).toEqual(
      expect.arrayContaining([
        GuardarConfiguracionSireUseCase,
        ConsultarEstadoConfiguracionSireUseCase,
        PrismaSireConfigurationRepository,
      ]),
    );
  });

  it('binds the configuration port to the Prisma adapter', () => {
    const binding = providers.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        (provider as { provide: unknown }).provide ===
          SIRE_CONFIGURATION_REPOSITORY_PORT,
    ) as { useExisting: unknown } | undefined;

    expect(binding).toBeDefined();
    expect(binding?.useExisting).toBe(PrismaSireConfigurationRepository);
  });
});

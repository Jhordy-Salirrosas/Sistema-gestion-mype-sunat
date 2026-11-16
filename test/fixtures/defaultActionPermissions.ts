import { ActionPermissionsService } from '../../src/modules/auth/application/services/actionPermissionsService';

/** Defaults reales en pruebas de rutas sin persistencia de permisos. */
export const defaultActionPermissionsProvider = {
  provide: ActionPermissionsService,
  useFactory: () => new ActionPermissionsService({
    roleActionPermission: { findMany: async () => [] },
  } as never),
};

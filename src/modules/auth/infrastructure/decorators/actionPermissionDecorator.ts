import { SetMetadata } from '@nestjs/common';
import type { ActionCode } from '../../application/services/actionPermissionsService';

export const ACTION_PERMISSION_KEY = 'actionPermission';
export interface ActionRequirement { actionCode: ActionCode; differentIssueDateOnly: boolean }
export const RequireAction = (actionCode: ActionCode, differentIssueDateOnly = false) =>
  SetMetadata(ACTION_PERMISSION_KEY, { actionCode, differentIssueDateOnly } satisfies ActionRequirement);

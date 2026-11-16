import { SetMetadata } from '@nestjs/common';
import type { CapabilityCode } from '../../domain/securityCatalog';
export const CAPABILITY_KEY='role-capability';
export const RequireCapability=(code:CapabilityCode)=>SetMetadata(CAPABILITY_KEY,code);

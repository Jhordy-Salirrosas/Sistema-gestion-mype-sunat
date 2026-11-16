import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor, UnauthorizedException } from '@nestjs/common';
const WRITES = new Set(['POST','PUT','PATCH','DELETE']);
/** Solo configuración, nunca operación (asientos, cierres, compras o emisión).
 * Los GET de catálogos, series/checklist y maestro se comparten con formularios.
 * Partners y sus datos no son configuración global: conservan su autorización.
 */
export const CONFIGURATION_WRITE_PREFIXES = [
  '/api/v1/master-data/currencies', '/api/v1/master-data/exchange-rates',
  '/api/v1/master-data/countries', '/api/v1/master-data/ports',
  '/api/v1/master-data/incoterms', '/api/v1/master-data/document-types',
  '/api/v1/master-data/accounting-mappings', '/api/v1/master-data/services',
  '/api/v1/accounting/accounts', '/api/v1/accounting/rules',
  '/api/v1/accounting/mappings', '/api/v1/accounting/treasury-accounts',
  '/api/v1/inventory/kardex/config', '/api/v1/sire/configuracion',
  '/api/v1/invoices/config', '/api/v1/invoices/series',
  '/api/v1/invoices/commercial-defaults',
];
const belongs = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
@Injectable()
export class ConfigurationAdminInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const path = String(request.originalUrl ?? request.url ?? '').split('?')[0].toLowerCase();
    const reserved = WRITES.has(request.method) && CONFIGURATION_WRITE_PREFIXES.some(prefix => belongs(path,prefix)) ||
      request.method === 'GET' && belongs(path,'/api/v1/sire/configuracion');
    if (reserved) {
      if (!request.user) throw new UnauthorizedException('Autenticación requerida.');
      if (request.user.role !== 'ADMIN') throw new ForbiddenException('La configuración global solo puede ser administrada por ADMIN.');
    }
    return next.handle();
  }
}

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ModulePermissionsService } from '../../application/services/modulePermissionsService';

const MODULO_POR_RUTA: Array<[string, string]> = [
  ['/api/v1/inventory/purchases', 'M8'], ['/api/v1/inventory', 'M6'], ['/api/v1/purchases', 'M8'],
  ['/api/v1/purchase-orders', 'M8'], ['/api/v1/invoices', 'M1'], ['/api/v1/customs', 'M2'], ['/api/v1/sire', 'M3'],
  ['/api/v1/accounting', 'M4'], ['/api/v1/treasury', 'M4'], ['/api/v1/expenses', 'M4'],
  ['/api/v1/sales', 'M7'], ['/api/v1/warehouses', 'M6'],
];
const ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class ModuleWriteInterceptor implements NestInterceptor {
  constructor(private readonly permisos: ModulePermissionsService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.role === 'ADMIN' || !ESCRITURA.has(request.method)) return next.handle();
    const ruta = String(request.originalUrl ?? request.url ?? '');
    if (ruta.includes('/api/v1/auth') || ruta.includes('/api/v1/health')) return next.handle();
    const modulo = MODULO_POR_RUTA.find(([prefijo]) => ruta.startsWith(prefijo))?.[1];
    if (!modulo) return next.handle();
    await this.permisos.assertWrite(user.companyId, user.role, modulo);
    return next.handle();
  }
}

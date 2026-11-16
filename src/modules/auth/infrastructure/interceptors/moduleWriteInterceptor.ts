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
const LECTURA = new Set(['GET', 'HEAD']);
const pertenece = (ruta: string, prefijo: string) => ruta === prefijo || ruta.startsWith(`${prefijo}/`);

// Solo se aplica el mapa existente. Auth y master-data son accesos compartidos;
// health, resilience, dashboards, UX y cualquier prefijo no listado quedan fuera.
// HEAD sigue la comprobación de GET, pues Nest/Express lo resuelve en su handler.

@Injectable()
export class ModuleWriteInterceptor implements NestInterceptor {
  constructor(private readonly permisos: ModulePermissionsService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const lectura = LECTURA.has(request.method);
    if (!user || (!lectura && (!ESCRITURA.has(request.method) || user.role === 'ADMIN'))) return next.handle();
    const ruta = String(request.originalUrl ?? request.url ?? '').split('?')[0];
    if (['/api/v1/auth', '/api/v1/master-data', '/api/v1/health'].some(prefijo => pertenece(ruta, prefijo))) return next.handle();
    const modulo = MODULO_POR_RUTA.find(([prefijo]) => pertenece(ruta, prefijo))?.[1];
    if (!modulo) return next.handle();
    if (lectura) await this.permisos.assertView(user.companyId, user.role, modulo);
    else await this.permisos.assertWrite(user.companyId, user.role, modulo);
    return next.handle();
  }
}

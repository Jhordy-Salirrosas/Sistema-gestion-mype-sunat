import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
/** Accesos administrativos; no duplica las pantallas ni cambia sus contratos. */
export const CONFIGURATION_LINKS = [
  { label: 'Datos fiscales de la empresa, SOL y certificado', path: '/invoices/configuracion#empresa' },
  { label: 'Series de comprobantes', path: '/invoices/configuracion#series' },
  { label: 'Configuración de facturación', path: '/invoices/configuracion#facturacion' },
  { label: 'Roles, módulos, menús y acciones', path: '/usuarios/permisos' },
  { label: 'Usuarios y accesos a almacenes', path: '/usuarios/almacenes' },
  { label: 'Compras: reglas contables del proceso COMPRA', path: '/accounting/rules' },
  { label: 'Ventas: reglas contables del proceso VENTA', path: '/accounting/rules' },
  { label: 'Configuración de importación', path: '/customs/config' },
  { label: 'Contabilidad: plan de cuentas', path: '/accounting/plan-cuentas' },
  { label: 'Contabilidad: períodos', path: '/accounting/periods' },
  { label: 'Configuración SIRE', path: '/sire/configuracion' },
];
@Controller('api/v1/configuration')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class ConfigurationHubController {
  @Get('links') links() { return CONFIGURATION_LINKS; }
}

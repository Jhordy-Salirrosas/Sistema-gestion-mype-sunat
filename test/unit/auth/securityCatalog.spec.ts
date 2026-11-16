import { CAPABILITIES, SYSTEM_ROLES, capabilityAllowed } from '../../../src/modules/auth/domain/securityCatalog';
import { MENU_CATALOG } from '../../../src/modules/auth/domain/menuCatalog';
import endpoints from '../../fixtures/legacyEndpointRoles.json';
import routes from '../../fixtures/legacyRouteRoles.json';

describe('Equivalencia del catálogo anterior (back d28ffc8059, front dcf7864b)', () => {
  it('enumera los 72 usos de ruta, con códigos únicos, padres conocidos y sin ciclos', () => {
    expect(MENU_CATALOG).toHaveLength(72);
    expect(new Set(MENU_CATALOG.map(m => m.code)).size).toBe(72);
    expect(MENU_CATALOG.map(m => m.path)).toEqual(routes.map(m => m.path));
    for (const menu of MENU_CATALOG) {
      const seen = new Set<string>(); let parent: string | null = menu.code;
      while (parent) { expect(seen.has(parent)).toBe(false); seen.add(parent); const node=MENU_CATALOG.find(m=>m.code===parent); expect(node).toBeDefined(); parent=node!.parentCode; }
      expect(menu.roles).toEqual(routes.find(m=>m.path===menu.path)!.roles);
    }
  });
  it('mantiene los 19 decoradores y dos casos especiales, con clasificación explícita', () => {
    expect(endpoints).toHaveLength(21);
    expect(endpoints.filter(e=>e.scope==='clase completa')).toHaveLength(4);
    for (const endpoint of endpoints) expect(CAPABILITIES.some(a=>a.code===endpoint.capability)).toBe(true);
  });
  it('demuestra equivalencia por endpoint para cinco roles, 16 combinaciones de overrides y cuatro matrices M1', () => {
    const original = ['INVOICE_EDIT_ISSUE_DATE','INVOICE_FORCE_RESEND','INVOICE_RESOLVE_DLQ','INVOICE_REPROCESS_BRIDGE'];
    for (const endpoint of endpoints) for (const role of SYSTEM_ROLES) for (let mask=0;mask<16;mask++) for (const view of [false,true]) for (const write of [false,true]) {
      const i=original.indexOf(endpoint.capability);
      const override=i<0?undefined:Boolean(mask&(1<<i));
      // Snapshot independiente: acceso por @Roles/servicio anterior + acción del paquete 1.
      const oldRoleAccess=endpoint.legacyRoles.includes(role);
      const oldActionAccess=i<0||override===true;
      const oldModuleAccess=endpoint.scope==='efecto lateral'?view:role==='ADMIN'||write;
      expect(capabilityAllowed(role,endpoint.capability,override)&&oldModuleAccess).toBe(oldRoleAccess&&oldActionAccess&&oldModuleAccess);
    }
  });
  it('la edición de fecha conserva concesiones explícitas y una denegación ADMIN manda', () => {
    expect(capabilityAllowed('OPERADOR_FACTURACION','INVOICE_EDIT_ISSUE_DATE',true)).toBe(true);
    expect(capabilityAllowed('ADMIN','INVOICE_FORCE_RESEND',false)).toBe(false);
    expect(capabilityAllowed('OPERADOR_FACTURACION','INVOICE_FORCE_RESEND',true)).toBe(false);
  });
  it('un nombre parecido no hereda privilegios; roles propios y acciones desconocidas denegados', () => {
    expect(capabilityAllowed('ADMINISTRADOR','INVOICE_EMIT',true)).toBe(false);
    expect(capabilityAllowed('PROPIO','INVOICE_EMIT')).toBe(false);
    expect(capabilityAllowed('PROPIO','INVOICE_EMIT',true,true)).toBe(true);
    expect(capabilityAllowed('PROPIO','INVOICE_CONFIG_EDIT',true,true)).toBe(false);
    expect(capabilityAllowed('ADMIN','DESCONOCIDA',true)).toBe(false);
  });
});

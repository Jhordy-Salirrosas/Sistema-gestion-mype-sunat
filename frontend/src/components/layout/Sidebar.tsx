import { useServerPermissions } from '@/modules/auth/hooks/useServerPermissions';
import { Fragment, useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUiStore } from '@/stores/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  Activity,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FileCheck2,
  FilePlus,
  FileMinus2,
  FileText,
  FileX2,
  Receipt,
  WalletCards,
  FolderGit2,
  GitCompareArrows,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  FileUp,
  ClipboardCheck,
  History,
  Settings,
  ShoppingCart,
  RotateCcw,
  Banknote,
  Ship,
  ShoppingBag,
  Search,
  Sparkles,
} from 'lucide-react';

export interface SubNavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Roles que pueden ver este subítem dentro del módulo.
   *
   * Sin esto heredaría los roles del padre y ofrecería entradas que la propia
   * ruta rechaza: el caso de Configuración de Facturación, que solo admite
   * ADMIN pero aparecería a un operador y lo llevaría a "sin acceso".
   */

  /** Agrupador visual dentro del módulo (ej. Registros / Reportes). */
  group?: string;
  /**
   * El submódulo es nuevo y el servidor todavía no lo conoce en su catálogo de
   * menús. Se muestra si el usuario puede ver el módulo, sin esperar a que el
   * backend lo publique: de lo contrario, cada pantalla nueva obligaría a
   * redesplegar el servidor antes de poder entrar.
   */
  adelanto?: { moduleCode: string };
}

export interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  developer: string;

  subItems?: SubNavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: 'Ventas',
    path: '/sales',
    icon: ShoppingCart,
    developer: 'Ventas',

    subItems: [
      { title: 'Punto de venta', path: '/sales/pos', icon: ShoppingCart },
      { title: 'Cotizaciones', path: '/sales/cotizaciones', icon: FileText },
      { title: 'Pedidos', path: '/sales/pedidos', icon: FileText },
      { title: 'Cierre de caja', path: '/sales/caja', icon: Banknote },
      { title: 'Historial de ventas', path: '/sales/historial', icon: History },
      { title: 'Devoluciones de venta', path: '/sales/devoluciones', icon: RotateCcw },
      { title: 'Reporte de ventas y margen', path: '/sales/reportes', icon: LayoutDashboard },
      { title: 'Cuentas por cobrar y cobros', path: '/sales/cobranzas', icon: WalletCards },
    ],
  },
  {
    title: 'Facturación UBL 2.1',
    path: '/invoices',
    icon: FileText,
    developer: 'Jhordy Salirrosas',

    subItems: [
      { title: 'Resumen de facturación', path: '/invoices/dashboard', icon: LayoutDashboard },
      { title: 'Detracciones', path: '/invoices/detracciones', icon: WalletCards },
      { title: 'Facturas y Boletas', path: '/invoices/facturas', icon: FileText },
      { title: 'Clientes y proveedores', path: '/invoices/clientes', icon: Building2 },
      // La pantalla de emisión existía y funcionaba desde el Sprint 1, pero
      // ninguna entrada del menú llevaba a ella: solo se llegaba por URL o
      // desde el botón de asientos contables. El docente juzga lo que ve en el
      // menú, así que si no está aquí, para él el módulo no sabe emitir.
      { title: 'Emitir Comprobante', path: '/invoices/emision', icon: FilePlus },
      { title: 'Notas', path: '/invoices/notas', icon: FileMinus2 },
      { title: 'Anulación y Resúmenes Diarios', path: '/invoices/bajas', icon: FileX2 },
      { title: 'Monitor Outbox y CDR', path: '/invoices/monitor', icon: Activity },
      // La ruta `/invoices/configuracion` (TA-61) existía desde el Sprint 2 y
      // responde con `GET /invoices/config`, pero no figuraba en el menú: una
      // auditoría del 1 de noviembre recorrió todo el módulo y concluyó que la
      // pantalla "no existía", señalándola como el pedido repetido del docente.
      // El docente también juzga por el menú, así que la entrada es obligatoria.
      // Solo ADMIN porque así lo exige `RoleProtectedRoute` en la ruta.
      {
        title: 'Configuración',
        path: '/invoices/configuracion',
        icon: Settings,

      },
    ],
  },
  {
    title: 'Administración',
    path: '/usuarios',
    icon: Settings,
    developer: 'Administración',

    subItems: [
      { title: 'Usuarios y almacenes', path: '/usuarios/almacenes', icon: Settings },
      { title: 'Permisos por módulo', path: '/usuarios/permisos', icon: Settings },
    ],
  },
  {
    title: 'Importaciones',
    path: '/customs',
    icon: Ship,
    developer: 'Carlos Ahumada',

    subItems: [
      { title: 'Panel general', path: '/customs/dashboard', icon: LayoutDashboard },
      { title: '1. Pedidos al exterior', path: '/customs/orders', icon: FilePlus },
      { title: '2. Tránsito y arribo', path: '/customs/shipments', icon: FolderGit2 },
      { title: '3. Despacho y DAM', path: '/customs/declarations', icon: FileCheck2 },
      { title: '4. Recojo y almacén (Kardex)', path: '/customs/landed-cost', icon: Calculator },
      { title: 'Contabilidad y Asientos Aduaneros (PCGE / NIC 2)', path: '/customs/accounting', icon: BookOpen },
      { title: 'Proveedores del exterior', path: '/customs/suppliers', icon: Building2 },
      { title: 'Configuración aduanera', path: '/customs/config', icon: Settings },
    ],
  },
  {
    title: 'Compras',
    path: '/purchases',
    icon: ShoppingBag,
    developer: 'Carlos Ahumada',

    subItems: [
      { title: 'Resumen de compras', path: '/purchases/dashboard', icon: LayoutDashboard },
      { title: 'Registro de compras', path: '/purchases', icon: Receipt },
      { title: 'Cuentas por pagar', path: '/purchases/payables', icon: WalletCards },
      { title: 'Proveedores', path: '/invoices/clientes', icon: Building2 },
      { title: 'Gastos', path: '/purchases/expenses', icon: Receipt },
    ],
  },
  {
    title: 'Inventario y Kardex',
    path: '/inventory',
    icon: Boxes,
    developer: 'Carlos Ahumada',

    subItems: [
      { title: 'Resumen de inventario', path: '/inventory/dashboard', icon: LayoutDashboard, group: 'Inventario' },
      { title: 'Existencias y Catálogo', path: '/inventory/stocks', icon: Boxes, group: 'Inventario' },
      { title: 'Movimientos', path: '/inventory/movements', icon: GitCompareArrows, group: 'Inventario' },
      { title: 'Ajustes y toma física', path: '/inventory/adjustments', icon: ClipboardCheck, group: 'Inventario' },
      { title: 'Saldo inicial', path: '/inventory/opening', icon: FileUp, group: 'Inventario' },
      { title: 'Kardex valorizado', path: '/kardex/general', icon: BookOpen, group: 'Kardex' },
      { title: 'Configuración y Costeo', path: '/inventory/config', icon: Settings, group: 'Kardex' },
    ],
  },
  {
    title: 'SIRE',
    path: '/sire',
    icon: CheckSquare,
    developer: 'Diego Toledo',

    subItems: [
      { title: 'Configuración SUNAT', path: '/sire/configuracion', icon: Settings },
      { title: 'Credenciales SUNAT', path: '/sire/credenciales', icon: KeyRound },
      { title: 'Mapeo Contable', path: '/sire/mapeo-contable', icon: ListChecks },
      { title: 'Importar Propuesta', path: '/sire/importar', icon: FileUp },
      { title: 'Consulta de periodos', path: '/sire/periodos', icon: Search },
      { title: 'Conciliación y Cruce', path: '/sire/conciliacion', icon: GitCompareArrows },
      { title: 'Resumen de Cierre', path: '/sire/cierre', icon: ClipboardCheck },
      { title: 'Historial', path: '/sire/historial', icon: History },
    ],
  },
  {
    title: 'Contabilidad PCGE',
    path: '/accounting',
    icon: BookOpen,
    developer: 'Michael Velásquez',

    subItems: [
      { title: 'Resumen contable', path: '/accounting/dashboard', icon: LayoutDashboard, group: 'Registros' },
      { title: 'Libro Diario', path: '/accounting', icon: FileText, group: 'Registros' },
      { title: 'Cuentas Contables', path: '/accounting/plan-cuentas', icon: BookOpen, group: 'Registros' },
      { title: 'Períodos Contables', path: '/accounting/periods', icon: CalendarDays, group: 'Registros' },
      { title: 'Guía contable', path: '/accounting/guia', icon: BookOpen, group: 'Registros', adelanto: { moduleCode: 'M4' } },
      { title: 'Reglas de contabilización', path: '/accounting/rules', icon: Settings, group: 'Registros' },
      { title: 'Libro Mayor', path: '/accounting/ledger', icon: BookOpen, group: 'Reportes' },
      { title: 'Balance de Comprobación', path: '/accounting/trial-balance', icon: ClipboardCheck, group: 'Reportes' },
      { title: 'Estado de Resultados', path: '/accounting/income-statement', icon: FileText, group: 'Reportes' },
      { title: 'Balance General', path: '/accounting/balance-sheet', icon: ClipboardCheck, group: 'Reportes' },
      { title: 'Libros Electrónicos (PLE/SIRE)', path: '/accounting/ple', icon: FileCheck2, group: 'Reportes' },
    ],
  },
];

export const Sidebar = () => {
  const { isSidebarCollapsed } = useUiStore();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();


  const asideRef = useRef<HTMLElement>(null);
  const [menuQuery, setMenuQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    '/customs': true,
    '/inventory': true,
    '/sire': false,
    '/accounting': false,
  });

  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (
        item.subItems &&
        (location.pathname === item.path ||
          location.pathname.startsWith(`${item.path}/`) ||
          item.subItems.some((sub) =>
            location.pathname === sub.path || location.pathname.startsWith(`${sub.path}/`),
          ))
      ) {
        setExpandedItems((prev) => ({ ...prev, [item.path]: true }));
      }
    });
  }, [location.pathname]);

  // Mantiene visible el módulo activo aunque el menú tenga muchos ítems.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const activo = asideRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
      activo?.scrollIntoView?.({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

  const toggleExpand = (item: NavItem) => {
    setExpandedItems((prev) => {
      const willExpand = !prev[item.path];
      if (
        willExpand &&
        location.pathname !== item.path &&
        !location.pathname.startsWith(`${item.path}/`)
      ) {
        // Se navega al primer subítem que el rol SÍ puede abrir; si ninguno lo
        // es, al índice del módulo en lugar de a una ruta protegida.
        navigate(subItemsVisibles(item)[0]?.path ?? item.path);
      }
      return { ...prev, [item.path]: willExpand };
    });
  };

  const permissions = useServerPermissions();
  /**
   * Un subítem se muestra si el servidor lo autoriza o si es un adelanto del
   * frontend y el usuario puede ver su módulo. Así una pantalla nueva no queda
   * invisible hasta que el backend se redespliegue.
   */
  const puedeVerSubItem = (sub: SubNavItem): boolean => {
    if (permissions.canNavigate(sub.path)) return true;
    if (!sub.adelanto) return false;
    const menus = permissions.snapshot?.menus ?? [];
    const loConoceElServidor = menus.some(menu => menu.path === sub.path);
    return !loConoceElServidor && permissions.canView(sub.adelanto.moduleCode);
  };
  const subItemsVisibles = (item: NavItem): SubNavItem[] => (item.subItems ?? []).filter(puedeVerSubItem);
  const visibleNavItems = NAV_ITEMS.filter(item => permissions.canNavigate(item.path));
  const terminoMenu = menuQuery.trim().toLowerCase();
  const filteredNavItems = visibleNavItems.flatMap((item) => {
    if (!terminoMenu) return [item];
    const coincidePadre = `${item.title} ${item.path}`.toLowerCase().includes(terminoMenu);
    const subItems = item.subItems?.filter((sub) => `${sub.title} ${sub.path}`.toLowerCase().includes(terminoMenu));
    if (coincidePadre || subItems?.length) return [{ ...item, subItems: coincidePadre ? item.subItems : subItems }];
    return [];
  });

  return (
    <aside
      ref={asideRef}
      className={cn(
        'border-r bg-card transition-all duration-300 flex flex-col shrink-0',
        isSidebarCollapsed
          ? 'w-16 max-sm:hidden'
          : 'w-64 max-sm:absolute max-sm:inset-y-0 max-sm:left-0 max-sm:z-50 max-sm:shadow-xl'
      )}
      aria-label="Navegación principal"
    >
      <div className="h-14 border-b flex items-center px-4 gap-2 font-bold text-sm tracking-tight overflow-hidden">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        {!isSidebarCollapsed && (
          <span className="truncate bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            SYNC-SUNAT
          </span>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1.5 overflow-y-auto">
        {!isSidebarCollapsed ? <div className="relative px-1 pb-1"><Search className="absolute left-3 top-2 h-3.5 w-3.5 text-muted-foreground" /><input aria-label="Buscar en el menú" placeholder="Buscar módulo…" value={menuQuery} onChange={(e) => setMenuQuery(e.target.value)} className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-xs outline-none focus:ring-1 focus:ring-ring" /></div> : null}
        {filteredNavItems.map((item) => {
          const isModuleActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`) ||
            Boolean(item.subItems?.some((sub) =>
              location.pathname === sub.path || location.pathname.startsWith(`${sub.path}/`),
            ));
          const isExpanded = Boolean(terminoMenu) || Boolean(expandedItems[item.path]);

          return (
            <div key={item.path} className="space-y-1">
              {item.subItems ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(item)}
                  title={isSidebarCollapsed ? `${item.title} (${item.developer})` : undefined}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group text-left',
                    isModuleActive
                      ? 'bg-muted/50 text-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-3 truncate">
                    <item.icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isModuleActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    />
                    {!isSidebarCollapsed && (
                      <span className="truncate">{item.title}</span>
                    )}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!permissions.canWrite(permissions.snapshot?.menus.find(m => m.path.startsWith(item.path))?.moduleCode ?? '') ? (
                        <span className="text-[9px] uppercase font-bold px-1 py-0.5 rounded bg-muted text-muted-foreground">
                          Lectura
                        </span>
                      ) : item.badge ? (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          {item.badge}
                        </span>
                      ) : null}

                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform duration-200',
                          isExpanded
                            ? 'rotate-180 text-primary font-bold'
                            : 'text-muted-foreground group-hover:text-foreground'
                        )}
                      />
                    </div>
                  )}
                </button>
              ) : (
                <NavLink
                  to={item.path}
                  end={true}
                  title={isSidebarCollapsed ? `${item.title} (${item.developer})` : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && (
                    <div className="flex-1 flex items-center justify-between truncate">
                      <span className="truncate">{item.title}</span>
                      {!permissions.canWrite(permissions.snapshot?.menus.find(m => m.path.startsWith(item.path))?.moduleCode ?? '') ? (
                        <span className="text-[9px] uppercase font-bold px-1 py-0.5 rounded bg-muted text-muted-foreground">
                          Lectura
                        </span>
                      ) : item.badge ? (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                  )}
                </NavLink>
              )}

              {!isSidebarCollapsed && item.subItems && isExpanded && (
                <div className="pl-3 ml-3 border-l-2 border-border/80 space-y-0.5 py-0.5">
                  {subItemsVisibles(item).map((sub, index, visibles) => (
                    <Fragment key={sub.path}>
                      {sub.group && sub.group !== visibles[index - 1]?.group && (
                        <p className="px-2.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          {sub.group}
                        </p>
                      )}
                      <NavLink
                        to={sub.path}
                        end={true}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                            isActive
                              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )
                        }
                      >
                        <sub.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{sub.title}</span>
                      </NavLink>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {!isSidebarCollapsed && (
        <div className="p-3 border-t text-[11px] text-muted-foreground bg-muted/30">
          <p className="font-semibold text-foreground/80">SYNC-SUNAT v1.0.0</p>
          <p className="text-[10px] text-primary font-medium truncate">
            Rol: {user?.roleName || user?.role || 'Sin rol'}
          </p>
        </div>
      )}
    </aside>
  );
};
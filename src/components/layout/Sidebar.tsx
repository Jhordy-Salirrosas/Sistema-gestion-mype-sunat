import { Fragment, useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUiStore } from '@/stores/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { type Role } from '@/modules/auth/types/auth.types';
import { cn } from '@/lib/utils';
import {
  Activity,
  ArrowLeftRight,
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
  FolderGit2,
  GitCompareArrows,
  History,
  LayoutDashboard,
  FileUp,
  ClipboardCheck,
  Settings,
  Ship,
  Sparkles,
} from 'lucide-react';

interface SubNavItem {
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
  allowedRoles?: Role[];
  /** Agrupador visual dentro del módulo (ej. Registros / Reportes). */
  group?: string;
}

interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  developer: string;
  allowedRoles: Role[];
  subItems?: SubNavItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    title: 'Facturación UBL 2.1',
    path: '/invoices',
    icon: FileText,
    developer: 'Jhordy Salirrosas',
    allowedRoles: ['ADMIN', 'OPERADOR_FACTURACION', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT'],
    subItems: [
      { title: 'Facturas y Boletas', path: '/invoices/facturas', icon: FileText },
      // La pantalla de emisión existía y funcionaba desde el Sprint 1, pero
      // ninguna entrada del menú llevaba a ella: solo se llegaba por URL o
      // desde el botón de asientos contables. El docente juzga lo que ve en el
      // menú, así que si no está aquí, para él el módulo no sabe emitir.
      { title: 'Emitir Comprobante', path: '/invoices/emision', icon: FilePlus },
      { title: 'Notas', path: '/invoices/notas', icon: FileMinus2 },
      { title: 'Bajas y Resúmenes Diarios', path: '/invoices/bajas', icon: FileX2 },
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
        allowedRoles: ['ADMIN'],
      },
    ],
  },
  {
    title: 'Importaciones',
    path: '/customs',
    icon: Ship,
    developer: 'Carlos Ahumada',
    allowedRoles: ['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT'],
    subItems: [
      { title: 'Panel general', path: '/customs/dashboard', icon: LayoutDashboard },
      { title: '1. Pedidos al exterior', path: '/customs/orders', icon: FilePlus },
      { title: '2. Tránsito y arribo', path: '/customs/shipments', icon: FolderGit2 },
      { title: '3. Despacho y DAM', path: '/customs/declarations', icon: FileCheck2 },
      { title: '4. Recojo y almacén (Kardex)', path: '/customs/landed-cost', icon: Calculator },
      { title: 'Proveedores internacionales', path: '/customs/partners', icon: Building2, allowedRoles: ['ADMIN', 'OPERADOR_ADUANAS'] },
      { title: 'Configuración aduanera', path: '/customs/config', icon: Settings, allowedRoles: ['ADMIN'] },
    ],
  },
  {
    title: 'Inventario',
    path: '/inventory',
    icon: Boxes,
    developer: 'Carlos Ahumada',
    allowedRoles: ['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT'],
    subItems: [
      { title: 'Existencias y Catálogo', path: '/inventory/stocks', icon: LayoutDashboard },
      { title: 'Movimientos', path: '/inventory/movements', icon: GitCompareArrows },
      { title: 'Transferencias', path: '/inventory/transfers', icon: ArrowLeftRight, allowedRoles: ['ADMIN'] },
      { title: 'Ajustes y toma física', path: '/inventory/adjustments', icon: ClipboardCheck, allowedRoles: ['ADMIN'] },
      { title: 'Saldo inicial', path: '/inventory/opening', icon: FileUp, allowedRoles: ['ADMIN'] },
    ],
  },
  {
    title: 'Kardex',
    path: '/kardex',
    icon: BookOpen,
    developer: 'Carlos Ahumada',
    allowedRoles: ['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT'],
    subItems: [
      { title: 'Kardex general', path: '/kardex/general', icon: BookOpen },
      { title: 'Kardex por producto', path: '/kardex/producto', icon: BookOpen },
      { title: 'Libros PLE 12.1 / 13.1', path: '/kardex/ple', icon: FileCheck2 },
    ],
  },
  {
    title: 'SIRE',
    path: '/sire',
    icon: CheckSquare,
    developer: 'Diego Toledo',
    allowedRoles: ['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT'],
    subItems: [
      { title: 'Importar Propuesta', path: '/sire/importar', icon: FileUp },
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
    allowedRoles: ['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT'],
    subItems: [
      { title: 'Libro Diario (PCGE)', path: '/accounting', icon: FileText, group: 'Registros' },
      { title: 'Plan de Cuentas (PCGE)', path: '/accounting/plan-cuentas', icon: BookOpen, group: 'Registros' },
      { title: 'Períodos Contables', path: '/accounting/periods', icon: CalendarDays, group: 'Registros' },
      { title: 'Libro Mayor', path: '/accounting/ledger', icon: BookOpen, group: 'Reportes' },
      { title: 'Balance de Comprobación', path: '/accounting/trial-balance', icon: ClipboardCheck, group: 'Reportes' },
      { title: 'Estado de Resultados', path: '/accounting/income-statement', icon: FileText, group: 'Reportes' },
      { title: 'Balance General', path: '/accounting/balance-sheet', icon: ClipboardCheck, group: 'Reportes' },
      { title: 'Libros Electrónicos (PLE/SIRE)', path: '/accounting/ple', icon: FileCheck2, group: 'Reportes' },
    ],
  },
  {
    title: 'Resiliencia SUNAT',
    path: '/resilience',
    icon: Activity,
    badge: 'Caos',
    developer: 'Oliver Saldaña',
    allowedRoles: ['ADMIN', 'AUDITOR'],
  },
];

export const Sidebar = () => {
  const { isSidebarCollapsed } = useUiStore();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentRole = user?.role;

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    '/customs': true,
    '/inventory': true,
    '/kardex': true,
    '/sire': false,
    '/accounting': false,
  });

  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (
        item.subItems &&
        (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
      ) {
        setExpandedItems((prev) => ({ ...prev, [item.path]: true }));
      }
    });
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

  /**
   * Subítems que el rol actual puede abrir.
   *
   * ADMIN ve todos. Un subítem sin `allowedRoles` hereda el del padre, que ya
   * pasó el filtro de módulo; uno con roles se comprueba aparte para no ofrecer
   * entradas que la ruta rechazaría con "sin acceso".
   */
  const subItemsVisibles = (item: NavItem): SubNavItem[] => {
    const subs = item.subItems ?? [];
    if (!currentRole || currentRole === 'ADMIN') return subs;
    return subs.filter((sub) => !sub.allowedRoles || sub.allowedRoles.includes(currentRole));
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!currentRole || currentRole === 'ADMIN') return true;
    return item.allowedRoles.includes(currentRole);
  });

  return (
    <aside
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
        {visibleNavItems.map((item) => {
          const isModuleActive =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          const isExpanded = Boolean(expandedItems[item.path]);

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
                      {currentRole === 'AUDITOR' ? (
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
                      {currentRole === 'AUDITOR' ? (
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
            Rol: {currentRole || 'ADMIN'}
          </p>
        </div>
      )}
    </aside>
  );
};
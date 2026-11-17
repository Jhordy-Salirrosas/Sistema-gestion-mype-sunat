import { RATE_LIMIT_MESSAGE } from '@/lib/apiErrors';
import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleProtectedRoute } from './RoleProtectedRoute';
import { getPermissionHome } from './roleNavigation';
import { useServerPermissions } from '@/modules/auth/hooks/useServerPermissions';
import { Loader2 } from 'lucide-react';

// Carga perezosa (Route-based Code Splitting)
const LoginPage = React.lazy(() => import('@/modules/auth/pages/LoginPage'));
const RegisterPage = React.lazy(() => import('@/modules/auth/pages/RegisterPage'));
const ProfilePage = React.lazy(() => import('@/modules/auth/pages/ProfilePage'));
const SecurityPage = React.lazy(() => import('@/modules/auth/pages/SecurityPage'));

// La bandeja oficial es InvoiceList: en dev la rehizo Oliver para que la
// grilla se alimente del backend (GET /invoices), con reintento de CDR desde
// la fila. La alternativa pages/InvoicesListPage se retiró en la fusión del
// M1 para no dejar dos bandejas paralelas apuntando al mismo endpoint.
const InvoicesListPage = React.lazy(() => import('@/modules/invoices/InvoiceList'));
const InvoicesDashboardPage = React.lazy(() => import('@/modules/invoices/pages/InvoicesDashboardPage'));
const InvoiceEmissionPage = React.lazy(() => import('@/modules/invoices/pages/InvoiceEmissionPage'));
// TA-61: pestaña de configuración de FE. Se carga aparte porque casi nadie la
// abre a diario y no debe pesar en la primera carga del módulo.
const InvoicePricesPage = React.lazy(() => import('@/modules/invoices/pages/InvoicePricesPage'));
const InvoiceSettingsPage = React.lazy(() => import('@/modules/invoices/pages/InvoiceSettingsPage'));
const InvoiceBajasPage = React.lazy(() => import('@/modules/invoices/pages/InvoiceBajasPage'));
const InvoiceMonitorPage = React.lazy(() => import('@/modules/invoices/pages/InvoiceMonitorPage'));
const SalesReportPage = React.lazy(() => import('@/modules/invoices/pages/SalesReportPage'));
const InvoiceDetractionsPage = React.lazy(() => import('@/modules/invoices/pages/InvoiceDetractionsPage'));
const CustomsDashboardPage = React.lazy(() => import('@/modules/customs/pages/CustomsDashboardPage'));
const ImportOrdersPage = React.lazy(() => import('@/modules/customs/pages/ImportOrdersPage'));
const ShipmentsListPage = React.lazy(() => import('@/modules/customs/pages/ShipmentsListPage'));
const ShipmentDetailPage = React.lazy(() => import('@/modules/customs/pages/ShipmentDetailPage'));
const DeclarationsListPage = React.lazy(() => import('@/modules/customs/pages/DeclarationsListPage'));
const DuaRegistrationWizardPage = React.lazy(() => import('@/modules/customs/pages/DuaRegistrationWizardPage'));
const CustomsLiquidationPage = React.lazy(() => import('@/modules/customs/pages/CustomsLiquidationPage'));
const LandedCostSheetPage = React.lazy(() => import('@/modules/customs/pages/LandedCostSheetPage'));
const CustomsAccountingPage = React.lazy(() => import('@/modules/customs/pages/CustomsAccountingPage'));
const ForeignSuppliersPage = React.lazy(() => import('@/modules/customs/pages/ForeignSuppliersPage'));
const PartnersPage = React.lazy(() => import('@/modules/customs/pages/PartnersPage'));
const MasterDataPage = React.lazy(() => import('@/modules/customs/pages/MasterDataPage'));

const DuaCalculatorPage = React.lazy(() => import('@/modules/customs/pages/DuaCalculatorPage'));
const InventoryStocksPage = React.lazy(() => import('@/modules/inventory/pages/InventoryStocksPage'));
const InventoryDashboardPage = React.lazy(() => import('@/modules/inventory/pages/InventoryDashboardPage'));
const PurchasesPage = React.lazy(() => import('@/modules/purchases/pages/PurchasesPage'));
const PurchaseOrdersPage = React.lazy(() => import('@/modules/purchases/pages/PurchaseOrdersPage'));
const PurchasesDashboardPage = React.lazy(() => import('@/modules/purchases/pages/PurchasesDashboardPage'));
const PurchasesPayablesPage = React.lazy(() => import('@/modules/inventory/pages/PurchasesPayablesPage'));
const InventoryAdjustmentsPage = React.lazy(() => import('@/modules/inventory/pages/InventoryAdjustmentsPage'));
const InventoryConfigPage = React.lazy(() => import('@/modules/inventory/pages/InventoryConfigPage'));
const UserWarehousesPage = React.lazy(() => import('@/modules/auth/pages/UserWarehousesPage'));
const RolePermissionsPage = React.lazy(() => import('@/modules/auth/pages/RolePermissionsPage'));
const SalesPosPage = React.lazy(() => import('@/modules/sales/pages/SalesPosPage'));
const SalesHistoryPage = React.lazy(() => import('@/modules/sales/pages/SalesHistoryPage'));
const SalesReturnsPage = React.lazy(() => import('@/modules/sales/pages/SalesReturnsPage'));
const SalesQuotesPage = React.lazy(() => import('@/modules/sales/pages/SalesQuotesPage'));
const SalesOrdersPage = React.lazy(() => import('@/modules/sales/pages/SalesQuotesPage'));
const CashClosurePage = React.lazy(() => import('@/modules/sales/pages/CashClosurePage'));
const InventoryKardexPage = React.lazy(() => import('@/modules/inventory/pages/InventoryKardexPage'));
const InventoryOpeningPage = React.lazy(() => import('@/modules/inventory/pages/InventoryOpeningPage'));
const InventoryMovementsPage = React.lazy(() => import('@/modules/inventory/pages/InventoryMovementsPage'));
const ProductKardexPage = React.lazy(() => import('@/modules/inventory/pages/ProductKardexPage'));
const SireConfiguracionPage = React.lazy(() => import('@/modules/sire/pages/SireConfiguracionPage'));
const SireCredentialsPage = React.lazy(() => import('@/modules/sire/pages/SireCredentialsPage'));
const SireMapeoContablePage = React.lazy(() => import('@/modules/sire/pages/SireMapeoContablePage'));
const SireReconciliationPage = React.lazy(() => import('@/modules/sire/pages/SireReconciliationPage'));
const SireImportPage = React.lazy(() => import('@/modules/sire/pages/SireImportPage'));
const SirePeriodosPage = React.lazy(() => import('@/modules/sire/pages/SirePeriodosPage'));
const SireClosurePage = React.lazy(() => import('@/modules/sire/pages/SireClosurePage'));
const SireHistoryPage = React.lazy(() => import('@/modules/sire/pages/SireHistoryPage'));

// Submódulos de Contabilidad PCGE (M4)
const AccountingEntriesPage = React.lazy(() => import('@/modules/accounting/pages/AccountingEntriesPage'));
const AccountingDashboardPage = React.lazy(() => import('@/modules/accounting/pages/AccountingDashboardPage'));
const AccountingRulesPage = React.lazy(() => import('@/modules/accounting/pages/AccountingRulesPage'));
const ExpensesPage = React.lazy(() => import('@/modules/expenses/pages/ExpensesPage'));
const CollectionsPage = React.lazy(() => import('@/modules/collections/pages/CollectionsPage'));
const AccountingTaxBooksPage = React.lazy(() => import('@/modules/accounting/pages/AccountingTaxBooksPage'));
const AccountingPlanCuentasPage = React.lazy(() => import('@/modules/accounting/pages/AccountingPlanCuentasPage'));
const AccountingGuidePage = React.lazy(() => import('@/modules/accounting/pages/AccountingGuidePage'));
const AccountingPlePage = React.lazy(() => import('@/modules/accounting/pages/AccountingPlePage'));
const AccountingPeriodsPage = React.lazy(() => import('@/modules/accounting/pages/AccountingPeriodsPage'));
const AccountingLedgerPage = React.lazy(() => import('@/modules/accounting/pages/AccountingLedgerPage'));
const AccountingTrialBalancePage = React.lazy(() => import('@/modules/accounting/pages/AccountingTrialBalancePage'));
const AccountingIncomeStatementPage = React.lazy(() => import('@/modules/accounting/pages/AccountingIncomeStatementPage'));
const AccountingBalanceSheetPage = React.lazy(() => import('@/modules/accounting/pages/AccountingBalanceSheetPage'));
const AccountingAuditPage = React.lazy(() => import('@/modules/accounting/pages/AccountingAuditPage'));

// Fallback de carga durante la descarga del chunk
const PageLoadingFallback = () => (
  <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-muted-foreground">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
    <span className="text-xs font-medium">Cargando módulo...</span>
  </div>
);

// Redirección dinámica al módulo correspondiente según la Matriz RBAC del rol activo
const RoleHomeRedirect = () => {
  const p = useServerPermissions();
  if (p.isLoading) return <PageLoadingFallback />;
  if (p.isError) return <p role='alert'>{p.errorStatus === 429 ? RATE_LIMIT_MESSAGE : 'No se pudieron consultar los permisos.'}</p>;
  const target = getPermissionHome(p.homePath);
  return <Navigate to={target} replace />;
};

export const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Rutas Protegidas bajo Layout Principal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<RoleHomeRedirect />} />
            <Route path="/sin-accesos" element={<p role="status">No tiene accesos asignados.</p>} />

            {/* Módulo de Identidad & Perfil */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings/security" element={<SecurityPage />} />

            {/* [M1: Facturación] ADMIN, OPERADOR_FACTURACION, CONTADOR, AUDITOR */}
            <Route path="/invoices" element={<Navigate to="/invoices/dashboard" replace />} />
            <Route
              path="/invoices/dashboard"
              element={
                <RoleProtectedRoute >
                  <InvoicesDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/invoices/detracciones"
              element={
                <RoleProtectedRoute >
                  <InvoiceDetractionsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/invoices/reportes/ventas"
              element={
                <RoleProtectedRoute >
                  <SalesReportPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/invoices/facturas"
              element={
                <RoleProtectedRoute

                >
                  <InvoicesListPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/invoices/clientes" element={
              <RoleProtectedRoute >
                <PartnersPage key="billing" context="billing" />
              </RoleProtectedRoute>
            } />
            <Route
              path="/invoices/emision"
              element={
                <RoleProtectedRoute

                >
                  <InvoiceEmissionPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/invoices/notas"
              element={
                <RoleProtectedRoute

                >
                  <InvoicesListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/invoices/bajas"
              element={
                <RoleProtectedRoute

                >
                  <InvoiceBajasPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/invoices/monitor"
              element={
                <RoleProtectedRoute

                >
                  <InvoiceMonitorPage />
                </RoleProtectedRoute>
              }
            />
            {/*
              TA-61: configuración de Facturación Electrónica (entorno, series y
              checklist previo a emitir). Solo ADMIN: la pantalla muestra el
              estado del certificado y de las credenciales SOL, que es
              información de administración, no de operación diaria.
            */}
            <Route
              path="/invoices/configuracion"
              element={
                <RoleProtectedRoute >
                  <InvoiceSettingsPage />
                </RoleProtectedRoute>
              }
            />

            <Route path="/invoices/configuracion/precios" element={<RoleProtectedRoute ><InvoicePricesPage /></RoleProtectedRoute>} />
            <Route path="/usuarios/almacenes" element={<RoleProtectedRoute ><UserWarehousesPage /></RoleProtectedRoute>} />
            <Route path="/usuarios/permisos" element={<RoleProtectedRoute ><RolePermissionsPage /></RoleProtectedRoute>} />
            <Route path="/sales" element={<RoleProtectedRoute ><SalesPosPage /></RoleProtectedRoute>} />
            <Route path="/sales/pos" element={<RoleProtectedRoute ><SalesPosPage /></RoleProtectedRoute>} />
            <Route path="/sales/historial" element={<RoleProtectedRoute ><SalesHistoryPage /></RoleProtectedRoute>} />
            <Route path="/sales/devoluciones" element={<RoleProtectedRoute ><SalesReturnsPage /></RoleProtectedRoute>} />
            <Route path="/sales/cotizaciones" element={<RoleProtectedRoute ><SalesQuotesPage /></RoleProtectedRoute>} />
            <Route path="/sales/pedidos" element={<RoleProtectedRoute ><SalesOrdersPage /></RoleProtectedRoute>} />
            <Route path="/sales/caja" element={<RoleProtectedRoute ><CashClosurePage /></RoleProtectedRoute>} />
            <Route path="/sales/reportes" element={<RoleProtectedRoute ><SalesReportPage /></RoleProtectedRoute>} />

            {/* [M3: Suite Aduanera e Inventarios] ADMIN, OPERADOR_ADUANAS, CONTADOR, AUDITOR */}
            <Route
              path="/customs"
              element={
                <RoleProtectedRoute

                >
                  <CustomsDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/dashboard"
              element={
                <RoleProtectedRoute

                >
                  <CustomsDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/orders"
              element={
                <RoleProtectedRoute

                >
                  <ImportOrdersPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/suppliers"
              element={
                <RoleProtectedRoute

                >
                  <ForeignSuppliersPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/partners"
              element={
                <RoleProtectedRoute >
                  <Navigate to="/invoices/clientes" replace />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/config"
              element={
                <RoleProtectedRoute >
                  <MasterDataPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/shipments"
              element={
                <RoleProtectedRoute

                >
                  <ShipmentsListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/shipments/:id"
              element={
                <RoleProtectedRoute

                >
                  <ShipmentDetailPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/declarations"
              element={
                <RoleProtectedRoute

                >
                  <DeclarationsListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/declarations/new"
              element={
                <RoleProtectedRoute

                >
                  <DuaRegistrationWizardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/settlements"
              element={
                <RoleProtectedRoute

                >
                  <CustomsLiquidationPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/landed-cost"
              element={
                <RoleProtectedRoute

                >
                  <LandedCostSheetPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/shipments/:id/landed-cost"
              element={
                <RoleProtectedRoute

                >
                  <LandedCostSheetPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/accounting"
              element={
                <RoleProtectedRoute

                >
                  <CustomsAccountingPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/inventory/kardex"
              element={
                <RoleProtectedRoute

                >
                  <Navigate to="/inventory/kardex" replace />
                </RoleProtectedRoute>
              }
            />
            <Route path="/customs/sire-purchases" element={<Navigate to="/sire/conciliacion" replace />} />
            <Route path="/customs/reports/fiscal-sire" element={<Navigate to="/sire/conciliacion" replace />} />
            {/* Ruta legacy de retrocompatibilidad */}
            <Route
              path="/customs/legacy"
              element={
                <RoleProtectedRoute

                >
                  <DuaCalculatorPage />
                </RoleProtectedRoute>
              }
            />

            {/* [Módulo de Compras Autónomo - Fase 1] */}
            <Route
              path="/purchases/dashboard"
              element={
                <RoleProtectedRoute >
                  <PurchasesDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/purchases/payables"
              element={
                <RoleProtectedRoute >
                  <PurchasesPayablesPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/purchases"
              element={
                <RoleProtectedRoute

                >
                  <PurchasesPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/purchases/orders"
              element={
                <RoleProtectedRoute >
                  <PurchaseOrdersPage />
                </RoleProtectedRoute>
              }
            />

            {/* [Módulo de Inventario Autónomo - Fase 3.0] */}
            <Route path="/inventory" element={<Navigate to="/inventory/dashboard" replace />} />
            <Route
              path="/inventory/dashboard"
              element={
                <RoleProtectedRoute >
                  <InventoryDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/inventory/purchases" element={<Navigate to="/purchases" replace />} />
            <Route path="/inventory/purchases/payables" element={<Navigate to="/purchases/payables" replace />} />
            <Route
              path="/inventory/stocks"
              element={
                <RoleProtectedRoute

                >
                  <InventoryStocksPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/inventory/products" element={<Navigate to="/inventory/stocks" replace />} />
            <Route path="/inventory/warehouses" element={<Navigate to="/inventory/stocks" replace />} />
            <Route
              path="/inventory/movements"
              element={
                <RoleProtectedRoute

                >
                  <InventoryMovementsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/inventory/transfers"
              element={<Navigate to="/inventory/movements?tab=transfers" replace />}
            />
            <Route
              path="/inventory/adjustments"
              element={
                <RoleProtectedRoute >
                  <InventoryAdjustmentsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/inventory/opening"
              element={
                <RoleProtectedRoute >
                  <InventoryOpeningPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/inventory/config"
              element={
                <RoleProtectedRoute >
                  <InventoryConfigPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/kardex/config" element={<Navigate to="/inventory/config" replace />} />

            {/* Redirecciones de retrocompatibilidad hacia el nuevo módulo Kardex */}
            <Route path="/inventory/kardex-general" element={<Navigate to="/kardex/general" replace />} />
            <Route path="/inventory/kardex" element={<Navigate to="/kardex/producto" replace />} />
            <Route path="/inventory/books" element={<Navigate to="/accounting/ple" replace />} />

            {/* [Módulo de Kardex Autónomo - Fase 3.0] */}
            <Route path="/kardex" element={<Navigate to="/kardex/general" replace />} />
            <Route
              path="/kardex/general"
              element={
                <RoleProtectedRoute

                >
                  <InventoryKardexPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/kardex/producto"
              element={
                <RoleProtectedRoute

                >
                  <ProductKardexPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/kardex/ple" element={<Navigate to="/accounting/ple" replace />} />
            <Route path="/kardex/sire" element={<Navigate to="/sire/conciliacion" replace />} />

            {/* [M4: SIRE] ADMIN, CONTADOR, AUDITOR */}
            <Route
              path="/sire"
              element={<Navigate to="/sire/conciliacion" replace />}
            />
            <Route
              path="/sire/configuracion"
              element={
                <RoleProtectedRoute >
                  <SireConfiguracionPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/sire/credenciales"
              element={
                <RoleProtectedRoute >
                  <SireCredentialsPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/sire/config" element={<Navigate to="/sire/configuracion" replace />} />
            <Route
              path="/sire/mapeo-contable"
              element={
                <RoleProtectedRoute >
                  <SireMapeoContablePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/sire/importar"
              element={
                <RoleProtectedRoute >
                  <SireImportPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/sire/periodos"
              element={
                <RoleProtectedRoute >
                  <SirePeriodosPage />
                </RoleProtectedRoute>
              }
            />
            {/* Ruta legacy: la consulta asíncrona de periodos sustituyó a la consulta manual */}
            <Route path="/sire/consulta-manual" element={<Navigate to="/sire/periodos" replace />} />
            <Route
              path="/sire/conciliacion"
              element={
                <RoleProtectedRoute >
                  <SireReconciliationPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/sire/cierre"
              element={
                <RoleProtectedRoute >
                  <SireClosurePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/sire/historial"
              element={
                <RoleProtectedRoute >
                  <SireHistoryPage />
                </RoleProtectedRoute>
              }
            />

            {/* [M5: Contabilidad PCGE] ADMIN, CONTADOR, AUDITOR */}
            <Route
              path="/accounting/dashboard"
              element={
                <RoleProtectedRoute >
                  <AccountingDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting"
              element={
                <RoleProtectedRoute >
                  <AccountingEntriesPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/ledger"
              element={
                <RoleProtectedRoute >
                  <AccountingLedgerPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/income-statement"
              element={
                <RoleProtectedRoute >
                  <AccountingIncomeStatementPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/trial-balance"
              element={
                <RoleProtectedRoute >
                  <AccountingTrialBalancePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/balance-sheet"
              element={
                <RoleProtectedRoute >
                  <AccountingBalanceSheetPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/auditoria"
              element={
                <RoleProtectedRoute >
                  <AccountingAuditPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/sales/cobranzas"
              element={
                <RoleProtectedRoute >
                  <CollectionsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/collections"
              element={
                <RoleProtectedRoute >
                  <CollectionsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/purchases/expenses"
              element={
                <RoleProtectedRoute >
                  <ExpensesPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <RoleProtectedRoute >
                  <ExpensesPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/rules"
              element={
                <RoleProtectedRoute >
                  <AccountingRulesPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/guia"
              element={
                <RoleProtectedRoute >
                  <AccountingGuidePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/plan-cuentas"
              element={
                <RoleProtectedRoute >
                  <AccountingPlanCuentasPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/periods"
              element={
                <RoleProtectedRoute >
                  <AccountingPeriodsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/tax-books"
              element={
                <RoleProtectedRoute >
                  <AccountingTaxBooksPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/ple"
              element={
                <RoleProtectedRoute >
                  <AccountingPlePage />
                </RoleProtectedRoute>
              }
            />
          </Route>
        </Route>

        {/* Ruta comodín con redirección según rol */}
        <Route path="*" element={<RoleHomeRedirect />} />
      </Routes>
    </Suspense>
  );
};
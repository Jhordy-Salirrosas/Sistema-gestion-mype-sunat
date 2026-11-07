import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleProtectedRoute } from './RoleProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultRouteForRole } from './roleNavigation';
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
const InvoiceEmissionPage = React.lazy(() => import('@/modules/invoices/pages/InvoiceEmissionPage'));
// TA-61: pestaña de configuración de FE. Se carga aparte porque casi nadie la
// abre a diario y no debe pesar en la primera carga del módulo.
const InvoiceSettingsPage = React.lazy(() => import('@/modules/invoices/pages/InvoiceSettingsPage'));
const InvoiceBajasPage = React.lazy(() => import('@/modules/invoices/pages/InvoiceBajasPage'));
const InvoiceMonitorPage = React.lazy(() => import('@/modules/invoices/pages/InvoiceMonitorPage'));
const ResilienceDashboardPage = React.lazy(() => import('@/modules/resilience/pages/ResilienceDashboardPage'));
const CustomsDashboardPage = React.lazy(() => import('@/modules/customs/pages/CustomsDashboardPage'));
const ImportOrdersPage = React.lazy(() => import('@/modules/customs/pages/ImportOrdersPage'));
const ShipmentsListPage = React.lazy(() => import('@/modules/customs/pages/ShipmentsListPage'));
const ShipmentDetailPage = React.lazy(() => import('@/modules/customs/pages/ShipmentDetailPage'));
const DeclarationsListPage = React.lazy(() => import('@/modules/customs/pages/DeclarationsListPage'));
const DuaRegistrationWizardPage = React.lazy(() => import('@/modules/customs/pages/DuaRegistrationWizardPage'));
const CustomsLiquidationPage = React.lazy(() => import('@/modules/customs/pages/CustomsLiquidationPage'));
const LandedCostSheetPage = React.lazy(() => import('@/modules/customs/pages/LandedCostSheetPage'));
const PartnersPage = React.lazy(() => import('@/modules/customs/pages/PartnersPage'));
const MasterDataPage = React.lazy(() => import('@/modules/customs/pages/MasterDataPage'));

const DuaCalculatorPage = React.lazy(() => import('@/modules/customs/pages/DuaCalculatorPage'));
const InventoryStocksPage = React.lazy(() => import('@/modules/inventory/pages/InventoryStocksPage'));
const InventoryTransfersPage = React.lazy(() => import('@/modules/inventory/pages/InventoryTransfersPage'));
const InventoryAdjustmentsPage = React.lazy(() => import('@/modules/inventory/pages/InventoryAdjustmentsPage'));
const InventoryKardexPage = React.lazy(() => import('@/modules/inventory/pages/InventoryKardexPage'));
const InventoryOpeningPage = React.lazy(() => import('@/modules/inventory/pages/InventoryOpeningPage'));
const InventoryMovementsPage = React.lazy(() => import('@/modules/inventory/pages/InventoryMovementsPage'));
const ProductKardexPage = React.lazy(() => import('@/modules/inventory/pages/ProductKardexPage'));
const ElectronicBooksPage = React.lazy(() => import('@/modules/inventory/pages/ElectronicBooksPage'));
const SireReconciliationPage = React.lazy(() => import('@/modules/sire/pages/SireReconciliationPage'));
const SireImportPage = React.lazy(() => import('@/modules/sire/pages/SireImportPage'));

// Submódulos de Contabilidad PCGE (M4)
const AccountingEntriesPage = React.lazy(() => import('@/modules/accounting/pages/AccountingEntriesPage'));
const AccountingPlanCuentasPage = React.lazy(() => import('@/modules/accounting/pages/AccountingPlanCuentasPage'));
const AccountingPlePage = React.lazy(() => import('@/modules/accounting/pages/AccountingPlePage'));
const AccountingPeriodsPage = React.lazy(() => import('@/modules/accounting/pages/AccountingPeriodsPage'));
const AccountingLedgerPage = React.lazy(() => import('@/modules/accounting/pages/AccountingLedgerPage'));
const AccountingTrialBalancePage = React.lazy(() => import('@/modules/accounting/pages/AccountingTrialBalancePage'));
const AccountingIncomeStatementPage = React.lazy(() => import('@/modules/accounting/pages/AccountingIncomeStatementPage'));
const AccountingBalanceSheetPage = React.lazy(() => import('@/modules/accounting/pages/AccountingBalanceSheetPage'));

// Fallback de carga durante la descarga del chunk
const PageLoadingFallback = () => (
  <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-muted-foreground">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
    <span className="text-xs font-medium">Cargando módulo...</span>
  </div>
);

// Redirección dinámica al módulo correspondiente según la Matriz RBAC del rol activo
const RoleHomeRedirect = () => {
  const { user } = useAuth();
  const target = getDefaultRouteForRole(user?.role);
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

            {/* Módulo de Identidad & Perfil */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings/security" element={<SecurityPage />} />

            {/* [M1: Facturación] ADMIN, OPERADOR_FACTURACION, CONTADOR, AUDITOR */}
            <Route path="/invoices" element={<Navigate to="/invoices/facturas" replace />} />
            <Route
              path="/invoices/facturas"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_FACTURACION', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT']}
                >
                  <InvoicesListPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/invoices/clientes" element={
              <RoleProtectedRoute allowedRoles={['ADMIN', 'OPERADOR_FACTURACION', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT']}>
                <PartnersPage key="billing" context="billing" />
              </RoleProtectedRoute>
            } />
            <Route
              path="/invoices/emision"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_FACTURACION', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT']}
                >
                  <InvoiceEmissionPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/invoices/notas"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_FACTURACION', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT']}
                >
                  <InvoicesListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/invoices/bajas"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_FACTURACION', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT']}
                >
                  <InvoiceBajasPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/invoices/monitor"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_FACTURACION', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT']}
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
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <InvoiceSettingsPage />
                </RoleProtectedRoute>
              }
            />

            {/* [M2: Resiliencia] ADMIN, AUDITOR */}
            <Route
              path="/resilience"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'AUDITOR']}>
                  <ResilienceDashboardPage />
                </RoleProtectedRoute>
              }
            />

            {/* [M3: Suite Aduanera e Inventarios] ADMIN, OPERADOR_ADUANAS, CONTADOR, AUDITOR */}
            <Route
              path="/customs"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <CustomsDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/dashboard"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <CustomsDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/orders"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <ImportOrdersPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/partners"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <PartnersPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/config"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <MasterDataPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/shipments"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <ShipmentsListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/shipments/:id"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <ShipmentDetailPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/declarations"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <DeclarationsListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/declarations/new"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <DuaRegistrationWizardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/settlements"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <CustomsLiquidationPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/landed-cost"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <LandedCostSheetPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/shipments/:id/landed-cost"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <LandedCostSheetPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/customs/inventory/kardex"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
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
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}
                >
                  <DuaCalculatorPage />
                </RoleProtectedRoute>
              }
            />

            {/* [Módulo de Inventario Autónomo - Fase 3.0] */}
            <Route path="/inventory" element={<Navigate to="/inventory/stocks" replace />} />
            <Route
              path="/inventory/stocks"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT']}
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
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT']}
                >
                  <InventoryMovementsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/inventory/transfers"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <InventoryTransfersPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/inventory/adjustments"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <InventoryAdjustmentsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/inventory/opening"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <InventoryOpeningPage />
                </RoleProtectedRoute>
              }
            />

            {/* Redirecciones de retrocompatibilidad hacia el nuevo módulo Kardex */}
            <Route path="/inventory/kardex-general" element={<Navigate to="/kardex/general" replace />} />
            <Route path="/inventory/kardex" element={<Navigate to="/kardex/producto" replace />} />
            <Route path="/inventory/books" element={<Navigate to="/kardex/ple" replace />} />

            {/* [Módulo de Kardex Autónomo - Fase 3.0] */}
            <Route path="/kardex" element={<Navigate to="/kardex/general" replace />} />
            <Route
              path="/kardex/general"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT']}
                >
                  <InventoryKardexPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/kardex/producto"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN', 'OPERADOR_ADUANAS', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT']}
                >
                  <ProductKardexPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/kardex/ple"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
                  <ElectronicBooksPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/kardex/sire" element={<Navigate to="/sire/conciliacion" replace />} />

            {/* [M4: SIRE] ADMIN, CONTADOR, AUDITOR */}
            <Route
              path="/sire"
              element={<Navigate to="/sire/conciliacion" replace />}
            />
            <Route
              path="/sire/importar"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
                  <SireImportPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/sire/conciliacion"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
                  <SireReconciliationPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/sire/cierre" element={<Navigate to="/sire/conciliacion" replace />} />
            <Route path="/sire/historial" element={<Navigate to="/sire/conciliacion" replace />} />

            {/* [M5: Contabilidad PCGE] ADMIN, CONTADOR, AUDITOR */}
            <Route
              path="/accounting"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
                  <AccountingEntriesPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/ledger"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
                  <AccountingLedgerPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/income-statement"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
                  <AccountingIncomeStatementPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/trial-balance"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
                  <AccountingTrialBalancePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/balance-sheet"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
                  <AccountingBalanceSheetPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/plan-cuentas"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
                  <AccountingPlanCuentasPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/periods"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
                  <AccountingPeriodsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/accounting/ple"
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN', 'CONTADOR', 'AUDITOR', 'ACCOUNTANT']}>
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
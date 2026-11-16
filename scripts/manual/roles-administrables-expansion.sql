-- Expansión únicamente. No convierte users.role ni las dos tablas de permisos.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$
BEGIN
 IF to_regclass('public.users') IS NULL OR to_regclass('public.role_module_permissions') IS NULL OR to_regclass('public.role_action_permissions') IS NULL THEN
  RAISE EXCEPTION 'Faltan tablas del paquete 1; abortar expansión';
 END IF;
 IF to_regclass('public.company_roles') IS NOT NULL OR to_regclass('public.permission_menu_catalog') IS NOT NULL OR to_regclass('public.role_menu_permissions') IS NOT NULL THEN
  RAISE EXCEPTION 'El catálogo ya existe; verificar versión y checksum, no sobreescribir';
 END IF;
 IF EXISTS (SELECT 1 FROM public.users u LEFT JOIN public.companies c ON c.id=u.company_id WHERE c.id IS NULL) THEN
  RAISE EXCEPTION 'Usuarios con empresa huérfana';
 END IF;
 IF EXISTS (SELECT 1 FROM public.users WHERE role::text NOT IN ('ADMIN','CONTADOR','OPERADOR_FACTURACION','OPERADOR_ADUANAS','AUDITOR')) THEN
  RAISE EXCEPTION 'Códigos de rol no previstos';
 END IF;
END $$;
CREATE TABLE public.company_roles (
 company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 code text NOT NULL CHECK(length(code) BETWEEN 1 AND 64 AND code ~ '^[A-Z][A-Z0-9_]*$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
 is_system boolean NOT NULL DEFAULT false,
 PRIMARY KEY(company_id,code)
);
CREATE TABLE public.permission_menu_catalog (
 menu_code text PRIMARY KEY,
 module_code text NOT NULL CHECK(module_code IN ('M1','M2','M3','M4','M5','M6','M7','M8','M9','M10')),
 path_pattern text NOT NULL UNIQUE,
 parent_menu_code text REFERENCES public.permission_menu_catalog(menu_code) ON DELETE RESTRICT
);
CREATE TABLE public.role_menu_permissions (
 company_id text NOT NULL,
 role_code text NOT NULL,
 menu_code text NOT NULL REFERENCES public.permission_menu_catalog(menu_code) ON DELETE RESTRICT,
 can_view boolean NOT NULL DEFAULT false,
 PRIMARY KEY(company_id,role_code,menu_code),
 FOREIGN KEY(company_id,role_code) REFERENCES public.company_roles(company_id,code) ON DELETE RESTRICT ON UPDATE RESTRICT
);
INSERT INTO public.company_roles(company_id,code,name,is_system)
SELECT c.id,r.code,r.name,true FROM public.companies c CROSS JOIN (VALUES
 ('ADMIN','Administrador'),('CONTADOR','Contador'),('OPERADOR_FACTURACION','Operador de facturación'),('OPERADOR_ADUANAS','Operador de aduanas'),('AUDITOR','Auditor')
) r(code,name);
INSERT INTO public.permission_menu_catalog(menu_code,module_code,path_pattern) VALUES
 ('MENU_INVOICES_DASHBOARD','M1','/invoices/dashboard'),
 ('MENU_INVOICES_DETRACCIONES','M1','/invoices/detracciones'),
 ('MENU_INVOICES_REPORTES_VENTAS','M1','/invoices/reportes/ventas'),
 ('MENU_INVOICES_FACTURAS','M1','/invoices/facturas'),
 ('MENU_INVOICES_CLIENTES','M1','/invoices/clientes'),
 ('MENU_INVOICES_EMISION','M1','/invoices/emision'),
 ('MENU_INVOICES_NOTAS','M1','/invoices/notas'),
 ('MENU_INVOICES_BAJAS','M1','/invoices/bajas'),
 ('MENU_INVOICES_MONITOR','M1','/invoices/monitor'),
 ('MENU_INVOICES_CONFIGURACION','M1','/invoices/configuracion'),
 ('MENU_INVOICES_CONFIGURACION_PRECIOS','M1','/invoices/configuracion/precios'),
 ('MENU_USUARIOS_ALMACENES','M9','/usuarios/almacenes'),
 ('MENU_USUARIOS_PERMISOS','M9','/usuarios/permisos'),
 ('MENU_SALES','M7','/sales'),
 ('MENU_SALES_POS','M7','/sales/pos'),
 ('MENU_SALES_HISTORIAL','M7','/sales/historial'),
 ('MENU_SALES_DEVOLUCIONES','M7','/sales/devoluciones'),
 ('MENU_SALES_COTIZACIONES','M7','/sales/cotizaciones'),
 ('MENU_SALES_PEDIDOS','M7','/sales/pedidos'),
 ('MENU_SALES_CAJA','M7','/sales/caja'),
 ('MENU_SALES_REPORTES','M7','/sales/reportes'),
 ('MENU_CUSTOMS','M2','/customs'),
 ('MENU_CUSTOMS_DASHBOARD','M2','/customs/dashboard'),
 ('MENU_CUSTOMS_ORDERS','M2','/customs/orders'),
 ('MENU_CUSTOMS_SUPPLIERS','M2','/customs/suppliers'),
 ('MENU_CUSTOMS_PARTNERS','M2','/customs/partners'),
 ('MENU_CUSTOMS_CONFIG','M2','/customs/config'),
 ('MENU_CUSTOMS_SHIPMENTS','M2','/customs/shipments'),
 ('MENU_CUSTOMS_SHIPMENTS_ID','M2','/customs/shipments/:id'),
 ('MENU_CUSTOMS_DECLARATIONS','M2','/customs/declarations'),
 ('MENU_CUSTOMS_DECLARATIONS_NEW','M2','/customs/declarations/new'),
 ('MENU_CUSTOMS_SETTLEMENTS','M2','/customs/settlements'),
 ('MENU_CUSTOMS_LANDED_COST','M2','/customs/landed-cost'),
 ('MENU_CUSTOMS_SHIPMENTS_ID_LANDED_COST','M2','/customs/shipments/:id/landed-cost'),
 ('MENU_CUSTOMS_ACCOUNTING','M2','/customs/accounting'),
 ('MENU_CUSTOMS_INVENTORY_KARDEX','M2','/customs/inventory/kardex'),
 ('MENU_CUSTOMS_LEGACY','M2','/customs/legacy'),
 ('MENU_PURCHASES_DASHBOARD','M8','/purchases/dashboard'),
 ('MENU_PURCHASES_PAYABLES','M8','/purchases/payables'),
 ('MENU_PURCHASES','M8','/purchases'),
 ('MENU_PURCHASES_ORDERS','M8','/purchases/orders'),
 ('MENU_INVENTORY_DASHBOARD','M6','/inventory/dashboard'),
 ('MENU_INVENTORY_STOCKS','M6','/inventory/stocks'),
 ('MENU_INVENTORY_MOVEMENTS','M6','/inventory/movements'),
 ('MENU_INVENTORY_TRANSFERS','M6','/inventory/transfers'),
 ('MENU_INVENTORY_ADJUSTMENTS','M6','/inventory/adjustments'),
 ('MENU_INVENTORY_OPENING','M6','/inventory/opening'),
 ('MENU_INVENTORY_CONFIG','M6','/inventory/config'),
 ('MENU_KARDEX_GENERAL','M6','/kardex/general'),
 ('MENU_KARDEX_PRODUCTO','M6','/kardex/producto'),
 ('MENU_SIRE_CONFIGURACION','M3','/sire/configuracion'),
 ('MENU_SIRE_IMPORTAR','M3','/sire/importar'),
 ('MENU_SIRE_PERIODOS','M3','/sire/periodos'),
 ('MENU_SIRE_CONCILIACION','M3','/sire/conciliacion'),
 ('MENU_SIRE_CIERRE','M3','/sire/cierre'),
 ('MENU_SIRE_HISTORIAL','M3','/sire/historial'),
 ('MENU_ACCOUNTING_DASHBOARD','M4','/accounting/dashboard'),
 ('MENU_ACCOUNTING','M4','/accounting'),
 ('MENU_ACCOUNTING_LEDGER','M4','/accounting/ledger'),
 ('MENU_ACCOUNTING_INCOME_STATEMENT','M4','/accounting/income-statement'),
 ('MENU_ACCOUNTING_TRIAL_BALANCE','M4','/accounting/trial-balance'),
 ('MENU_ACCOUNTING_BALANCE_SHEET','M4','/accounting/balance-sheet'),
 ('MENU_ACCOUNTING_AUDITORIA','M4','/accounting/auditoria'),
 ('MENU_SALES_COBRANZAS','M7','/sales/cobranzas'),
 ('MENU_COLLECTIONS','M7','/collections'),
 ('MENU_PURCHASES_EXPENSES','M8','/purchases/expenses'),
 ('MENU_EXPENSES','M4','/expenses'),
 ('MENU_ACCOUNTING_RULES','M4','/accounting/rules'),
 ('MENU_ACCOUNTING_PLAN_CUENTAS','M4','/accounting/plan-cuentas'),
 ('MENU_ACCOUNTING_PERIODS','M4','/accounting/periods'),
 ('MENU_ACCOUNTING_TAX_BOOKS','M4','/accounting/tax-books'),
 ('MENU_ACCOUNTING_PLE','M4','/accounting/ple');
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_INVOICES_CONFIGURACION' WHERE menu_code='MENU_INVOICES_CONFIGURACION_PRECIOS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_SALES' WHERE menu_code='MENU_SALES_POS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_SALES' WHERE menu_code='MENU_SALES_HISTORIAL';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_SALES' WHERE menu_code='MENU_SALES_DEVOLUCIONES';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_SALES' WHERE menu_code='MENU_SALES_COTIZACIONES';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_SALES' WHERE menu_code='MENU_SALES_PEDIDOS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_SALES' WHERE menu_code='MENU_SALES_CAJA';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_SALES' WHERE menu_code='MENU_SALES_REPORTES';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_DASHBOARD';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_ORDERS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_SUPPLIERS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_PARTNERS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_CONFIG';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_SHIPMENTS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS_SHIPMENTS' WHERE menu_code='MENU_CUSTOMS_SHIPMENTS_ID';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_DECLARATIONS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS_DECLARATIONS' WHERE menu_code='MENU_CUSTOMS_DECLARATIONS_NEW';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_SETTLEMENTS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_LANDED_COST';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS_SHIPMENTS_ID' WHERE menu_code='MENU_CUSTOMS_SHIPMENTS_ID_LANDED_COST';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_ACCOUNTING';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_INVENTORY_KARDEX';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_CUSTOMS' WHERE menu_code='MENU_CUSTOMS_LEGACY';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_PURCHASES' WHERE menu_code='MENU_PURCHASES_DASHBOARD';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_PURCHASES' WHERE menu_code='MENU_PURCHASES_PAYABLES';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_PURCHASES' WHERE menu_code='MENU_PURCHASES_ORDERS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_DASHBOARD';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_LEDGER';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_INCOME_STATEMENT';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_TRIAL_BALANCE';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_BALANCE_SHEET';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_AUDITORIA';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_SALES' WHERE menu_code='MENU_SALES_COBRANZAS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_PURCHASES' WHERE menu_code='MENU_PURCHASES_EXPENSES';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_RULES';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_PLAN_CUENTAS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_PERIODS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_TAX_BOOKS';
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_PLE';
INSERT INTO public.role_menu_permissions(company_id,role_code,menu_code,can_view)
SELECT r.company_id,r.code,m.menu_code,r.code=ANY(m.roles)
FROM public.company_roles r CROSS JOIN (VALUES
 ('MENU_INVOICES_DASHBOARD',ARRAY['ADMIN','OPERADOR_FACTURACION','CONTADOR','AUDITOR']::text[]),
 ('MENU_INVOICES_DETRACCIONES',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_INVOICES_REPORTES_VENTAS',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_INVOICES_FACTURAS',ARRAY['ADMIN','OPERADOR_FACTURACION','CONTADOR','AUDITOR']::text[]),
 ('MENU_INVOICES_CLIENTES',ARRAY['ADMIN','OPERADOR_FACTURACION','CONTADOR','AUDITOR']::text[]),
 ('MENU_INVOICES_EMISION',ARRAY['ADMIN','OPERADOR_FACTURACION']::text[]),
 ('MENU_INVOICES_NOTAS',ARRAY['ADMIN','OPERADOR_FACTURACION','CONTADOR','AUDITOR']::text[]),
 ('MENU_INVOICES_BAJAS',ARRAY['ADMIN','OPERADOR_FACTURACION','CONTADOR','AUDITOR']::text[]),
 ('MENU_INVOICES_MONITOR',ARRAY['ADMIN','OPERADOR_FACTURACION','CONTADOR','AUDITOR']::text[]),
 ('MENU_INVOICES_CONFIGURACION',ARRAY['ADMIN']::text[]),
 ('MENU_INVOICES_CONFIGURACION_PRECIOS',ARRAY['ADMIN']::text[]),
 ('MENU_USUARIOS_ALMACENES',ARRAY['ADMIN']::text[]),
 ('MENU_USUARIOS_PERMISOS',ARRAY['ADMIN']::text[]),
 ('MENU_SALES',ARRAY['ADMIN','OPERADOR_FACTURACION']::text[]),
 ('MENU_SALES_POS',ARRAY['ADMIN','OPERADOR_FACTURACION']::text[]),
 ('MENU_SALES_HISTORIAL',ARRAY['ADMIN','OPERADOR_FACTURACION','CONTADOR','AUDITOR']::text[]),
 ('MENU_SALES_DEVOLUCIONES',ARRAY['ADMIN','OPERADOR_FACTURACION','CONTADOR']::text[]),
 ('MENU_SALES_COTIZACIONES',ARRAY['ADMIN','OPERADOR_FACTURACION']::text[]),
 ('MENU_SALES_PEDIDOS',ARRAY['ADMIN','OPERADOR_FACTURACION']::text[]),
 ('MENU_SALES_CAJA',ARRAY['ADMIN','OPERADOR_FACTURACION']::text[]),
 ('MENU_SALES_REPORTES',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_DASHBOARD',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_ORDERS',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_SUPPLIERS',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_PARTNERS',ARRAY['ADMIN']::text[]),
 ('MENU_CUSTOMS_CONFIG',ARRAY['ADMIN']::text[]),
 ('MENU_CUSTOMS_SHIPMENTS',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_SHIPMENTS_ID',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_DECLARATIONS',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_DECLARATIONS_NEW',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_SETTLEMENTS',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_LANDED_COST',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_SHIPMENTS_ID_LANDED_COST',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_ACCOUNTING',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_INVENTORY_KARDEX',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_CUSTOMS_LEGACY',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_PURCHASES_DASHBOARD',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_PURCHASES_PAYABLES',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_PURCHASES',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_PURCHASES_ORDERS',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR']::text[]),
 ('MENU_INVENTORY_DASHBOARD',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR']::text[]),
 ('MENU_INVENTORY_STOCKS',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR','OPERADOR_FACTURACION']::text[]),
 ('MENU_INVENTORY_MOVEMENTS',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR','OPERADOR_FACTURACION']::text[]),
 ('MENU_INVENTORY_TRANSFERS',ARRAY['ADMIN']::text[]),
 ('MENU_INVENTORY_ADJUSTMENTS',ARRAY['ADMIN']::text[]),
 ('MENU_INVENTORY_OPENING',ARRAY['ADMIN']::text[]),
 ('MENU_INVENTORY_CONFIG',ARRAY['ADMIN','CONTADOR']::text[]),
 ('MENU_KARDEX_GENERAL',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR','OPERADOR_FACTURACION']::text[]),
 ('MENU_KARDEX_PRODUCTO',ARRAY['ADMIN','OPERADOR_ADUANAS','CONTADOR','AUDITOR','OPERADOR_FACTURACION']::text[]),
 ('MENU_SIRE_CONFIGURACION',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_SIRE_IMPORTAR',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_SIRE_PERIODOS',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_SIRE_CONCILIACION',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_SIRE_CIERRE',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_SIRE_HISTORIAL',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_DASHBOARD',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_LEDGER',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_INCOME_STATEMENT',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_TRIAL_BALANCE',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_BALANCE_SHEET',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_AUDITORIA',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_SALES_COBRANZAS',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_COLLECTIONS',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_PURCHASES_EXPENSES',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_EXPENSES',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_RULES',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_PLAN_CUENTAS',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_PERIODS',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_TAX_BOOKS',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_PLE',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[])) m(menu_code,roles);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.permission_menu_catalog)<>72 THEN RAISE EXCEPTION 'Catálogo incompleto'; END IF;
 IF (SELECT count(*) FROM public.company_roles)<>(SELECT count(*)*5 FROM public.companies) THEN RAISE EXCEPTION 'Roles incompletos'; END IF;
 IF (SELECT count(*) FROM public.role_menu_permissions)<>(SELECT count(*)*72 FROM public.company_roles) THEN RAISE EXCEPTION 'Matriz incompleta'; END IF;
END $$;
COMMIT;

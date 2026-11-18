-- Adopción revisada; conserva datos y contratos existentes.
BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
DO $adopt$ DECLARE n int; actual jsonb; BEGIN
 SELECT count(*) INTO n FROM (VALUES(to_regclass('public.company_roles')),(to_regclass('public.permission_menu_catalog')),(to_regclass('public.role_menu_permissions'))) s(t) WHERE t IS NOT NULL;
 IF n=0 THEN EXECUTE $creation$CREATE TABLE public.company_roles (
 company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 code text NOT NULL CHECK(length(code) BETWEEN 1 AND 64 AND code ~ '^[A-Z][A-Z0-9_]*$' AND code NOT IN ('ACCOUNTANT','OPERATOR')),
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
 ('MENU_ACCOUNTING_GUIA','M4','/accounting/guia'),
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
UPDATE public.permission_menu_catalog SET parent_menu_code='MENU_ACCOUNTING' WHERE menu_code='MENU_ACCOUNTING_GUIA';
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
 ('MENU_ACCOUNTING_GUIA',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_PLAN_CUENTAS',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_PERIODS',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_TAX_BOOKS',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[]),
 ('MENU_ACCOUNTING_PLE',ARRAY['ADMIN','CONTADOR','AUDITOR']::text[])) m(menu_code,roles);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.permission_menu_catalog)<>73 THEN RAISE EXCEPTION 'Catálogo incompleto'; END IF;
 IF (SELECT count(*) FROM public.company_roles)<>(SELECT count(*)*5 FROM public.companies) THEN RAISE EXCEPTION 'Roles incompletos'; END IF;
 IF (SELECT count(*) FROM public.role_menu_permissions)<>(SELECT count(*)*73 FROM public.company_roles) THEN RAISE EXCEPTION 'Matriz incompleta'; END IF;
END $$;
$creation$; ELSIF n<>3 THEN RAISE EXCEPTION 'Expansión parcial'; END IF;
 LOCK TABLE public.companies, public.company_roles, public.permission_menu_catalog, public.role_menu_permissions IN ACCESS EXCLUSIVE MODE;
SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull,coalesce(pg_get_expr(d.adbin,d.adrelid),'')) ORDER BY a.attnum) INTO actual FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.company_roles'::regclass AND a.attnum>0 AND NOT a.attisdropped; IF actual IS DISTINCT FROM '[["company_id","text",true,""],["code","text",true,""],["name","text",true,""],["is_system","boolean",true,"false"]]'::jsonb THEN RAISE EXCEPTION 'Columnas incompatibles: company_roles'; END IF;
SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) ORDER BY conname) INTO actual FROM pg_constraint WHERE conrelid='public.company_roles'::regclass; IF actual IS DISTINCT FROM '[["company_roles_code_check","CHECK ((((length(code) >= 1) AND (length(code) <= 64)) AND (code ~ ''^[A-Z][A-Z0-9_]*$''::text) AND (code <> ALL (ARRAY[''ACCOUNTANT''::text, ''OPERATOR''::text]))))"],["company_roles_company_id_fkey","FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE"],["company_roles_name_check","CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 100)))"],["company_roles_pkey","PRIMARY KEY (company_id, code)"]]'::jsonb THEN RAISE EXCEPTION 'Constraints incompatibles: company_roles'; END IF;
SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull,coalesce(pg_get_expr(d.adbin,d.adrelid),'')) ORDER BY a.attnum) INTO actual FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.permission_menu_catalog'::regclass AND a.attnum>0 AND NOT a.attisdropped; IF actual IS DISTINCT FROM '[["menu_code","text",true,""],["module_code","text",true,""],["path_pattern","text",true,""],["parent_menu_code","text",false,""]]'::jsonb THEN RAISE EXCEPTION 'Columnas incompatibles: permission_menu_catalog'; END IF;
SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) ORDER BY conname) INTO actual FROM pg_constraint WHERE conrelid='public.permission_menu_catalog'::regclass; IF actual IS DISTINCT FROM '[["permission_menu_catalog_module_code_check","CHECK ((module_code = ANY (ARRAY[''M1''::text, ''M2''::text, ''M3''::text, ''M4''::text, ''M5''::text, ''M6''::text, ''M7''::text, ''M8''::text, ''M9''::text, ''M10''::text])))"],["permission_menu_catalog_parent_menu_code_fkey","FOREIGN KEY (parent_menu_code) REFERENCES permission_menu_catalog(menu_code) ON DELETE RESTRICT"],["permission_menu_catalog_path_pattern_key","UNIQUE (path_pattern)"],["permission_menu_catalog_pkey","PRIMARY KEY (menu_code)"]]'::jsonb THEN RAISE EXCEPTION 'Constraints incompatibles: permission_menu_catalog'; END IF;
SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull,coalesce(pg_get_expr(d.adbin,d.adrelid),'')) ORDER BY a.attnum) INTO actual FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.role_menu_permissions'::regclass AND a.attnum>0 AND NOT a.attisdropped; IF actual IS DISTINCT FROM '[["company_id","text",true,""],["role_code","text",true,""],["menu_code","text",true,""],["can_view","boolean",true,"false"]]'::jsonb THEN RAISE EXCEPTION 'Columnas incompatibles: role_menu_permissions'; END IF;
SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) ORDER BY conname) INTO actual FROM pg_constraint WHERE conrelid='public.role_menu_permissions'::regclass; IF actual IS DISTINCT FROM '[["role_menu_permissions_company_id_role_code_fkey","FOREIGN KEY (company_id, role_code) REFERENCES company_roles(company_id, code) ON UPDATE RESTRICT ON DELETE RESTRICT"],["role_menu_permissions_menu_code_fkey","FOREIGN KEY (menu_code) REFERENCES permission_menu_catalog(menu_code) ON DELETE RESTRICT"],["role_menu_permissions_pkey","PRIMARY KEY (company_id, role_code, menu_code)"]]'::jsonb THEN RAISE EXCEPTION 'Constraints incompatibles: role_menu_permissions'; END IF;
END $adopt$;
DO $data$ BEGIN
 IF EXISTS(SELECT 1 FROM permission_menu_catalog d LEFT JOIN jsonb_to_recordset('[{"menu_code":"MENU_INVOICES_DASHBOARD","module_code":"M1","path_pattern":"/invoices/dashboard","parent_menu_code":null},{"menu_code":"MENU_INVOICES_DETRACCIONES","module_code":"M1","path_pattern":"/invoices/detracciones","parent_menu_code":null},{"menu_code":"MENU_INVOICES_REPORTES_VENTAS","module_code":"M1","path_pattern":"/invoices/reportes/ventas","parent_menu_code":null},{"menu_code":"MENU_INVOICES_FACTURAS","module_code":"M1","path_pattern":"/invoices/facturas","parent_menu_code":null},{"menu_code":"MENU_INVOICES_CLIENTES","module_code":"M1","path_pattern":"/invoices/clientes","parent_menu_code":null},{"menu_code":"MENU_INVOICES_EMISION","module_code":"M1","path_pattern":"/invoices/emision","parent_menu_code":null},{"menu_code":"MENU_INVOICES_NOTAS","module_code":"M1","path_pattern":"/invoices/notas","parent_menu_code":null},{"menu_code":"MENU_INVOICES_BAJAS","module_code":"M1","path_pattern":"/invoices/bajas","parent_menu_code":null},{"menu_code":"MENU_INVOICES_MONITOR","module_code":"M1","path_pattern":"/invoices/monitor","parent_menu_code":null},{"menu_code":"MENU_INVOICES_CONFIGURACION","module_code":"M1","path_pattern":"/invoices/configuracion","parent_menu_code":null},{"menu_code":"MENU_INVOICES_CONFIGURACION_PRECIOS","module_code":"M1","path_pattern":"/invoices/configuracion/precios","parent_menu_code":"MENU_INVOICES_CONFIGURACION"},{"menu_code":"MENU_USUARIOS_ALMACENES","module_code":"M9","path_pattern":"/usuarios/almacenes","parent_menu_code":null},{"menu_code":"MENU_USUARIOS_PERMISOS","module_code":"M9","path_pattern":"/usuarios/permisos","parent_menu_code":null},{"menu_code":"MENU_SALES","module_code":"M7","path_pattern":"/sales","parent_menu_code":null},{"menu_code":"MENU_SALES_POS","module_code":"M7","path_pattern":"/sales/pos","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_HISTORIAL","module_code":"M7","path_pattern":"/sales/historial","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_DEVOLUCIONES","module_code":"M7","path_pattern":"/sales/devoluciones","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_COTIZACIONES","module_code":"M7","path_pattern":"/sales/cotizaciones","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_PEDIDOS","module_code":"M7","path_pattern":"/sales/pedidos","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_CAJA","module_code":"M7","path_pattern":"/sales/caja","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_REPORTES","module_code":"M7","path_pattern":"/sales/reportes","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_CUSTOMS","module_code":"M2","path_pattern":"/customs","parent_menu_code":null},{"menu_code":"MENU_CUSTOMS_DASHBOARD","module_code":"M2","path_pattern":"/customs/dashboard","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_ORDERS","module_code":"M2","path_pattern":"/customs/orders","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_SUPPLIERS","module_code":"M2","path_pattern":"/customs/suppliers","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_PARTNERS","module_code":"M2","path_pattern":"/customs/partners","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_CONFIG","module_code":"M2","path_pattern":"/customs/config","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_SHIPMENTS","module_code":"M2","path_pattern":"/customs/shipments","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_SHIPMENTS_ID","module_code":"M2","path_pattern":"/customs/shipments/:id","parent_menu_code":"MENU_CUSTOMS_SHIPMENTS"},{"menu_code":"MENU_CUSTOMS_DECLARATIONS","module_code":"M2","path_pattern":"/customs/declarations","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_DECLARATIONS_NEW","module_code":"M2","path_pattern":"/customs/declarations/new","parent_menu_code":"MENU_CUSTOMS_DECLARATIONS"},{"menu_code":"MENU_CUSTOMS_SETTLEMENTS","module_code":"M2","path_pattern":"/customs/settlements","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_LANDED_COST","module_code":"M2","path_pattern":"/customs/landed-cost","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_SHIPMENTS_ID_LANDED_COST","module_code":"M2","path_pattern":"/customs/shipments/:id/landed-cost","parent_menu_code":"MENU_CUSTOMS_SHIPMENTS_ID"},{"menu_code":"MENU_CUSTOMS_ACCOUNTING","module_code":"M2","path_pattern":"/customs/accounting","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_INVENTORY_KARDEX","module_code":"M2","path_pattern":"/customs/inventory/kardex","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_LEGACY","module_code":"M2","path_pattern":"/customs/legacy","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_PURCHASES_DASHBOARD","module_code":"M8","path_pattern":"/purchases/dashboard","parent_menu_code":"MENU_PURCHASES"},{"menu_code":"MENU_PURCHASES_PAYABLES","module_code":"M8","path_pattern":"/purchases/payables","parent_menu_code":"MENU_PURCHASES"},{"menu_code":"MENU_PURCHASES","module_code":"M8","path_pattern":"/purchases","parent_menu_code":null},{"menu_code":"MENU_PURCHASES_ORDERS","module_code":"M8","path_pattern":"/purchases/orders","parent_menu_code":"MENU_PURCHASES"},{"menu_code":"MENU_INVENTORY_DASHBOARD","module_code":"M6","path_pattern":"/inventory/dashboard","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_STOCKS","module_code":"M6","path_pattern":"/inventory/stocks","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_MOVEMENTS","module_code":"M6","path_pattern":"/inventory/movements","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_TRANSFERS","module_code":"M6","path_pattern":"/inventory/transfers","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_ADJUSTMENTS","module_code":"M6","path_pattern":"/inventory/adjustments","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_OPENING","module_code":"M6","path_pattern":"/inventory/opening","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_CONFIG","module_code":"M6","path_pattern":"/inventory/config","parent_menu_code":null},{"menu_code":"MENU_KARDEX_GENERAL","module_code":"M6","path_pattern":"/kardex/general","parent_menu_code":null},{"menu_code":"MENU_KARDEX_PRODUCTO","module_code":"M6","path_pattern":"/kardex/producto","parent_menu_code":null},{"menu_code":"MENU_SIRE_CONFIGURACION","module_code":"M3","path_pattern":"/sire/configuracion","parent_menu_code":null},{"menu_code":"MENU_SIRE_IMPORTAR","module_code":"M3","path_pattern":"/sire/importar","parent_menu_code":null},{"menu_code":"MENU_SIRE_PERIODOS","module_code":"M3","path_pattern":"/sire/periodos","parent_menu_code":null},{"menu_code":"MENU_SIRE_CONCILIACION","module_code":"M3","path_pattern":"/sire/conciliacion","parent_menu_code":null},{"menu_code":"MENU_SIRE_CIERRE","module_code":"M3","path_pattern":"/sire/cierre","parent_menu_code":null},{"menu_code":"MENU_SIRE_HISTORIAL","module_code":"M3","path_pattern":"/sire/historial","parent_menu_code":null},{"menu_code":"MENU_ACCOUNTING_DASHBOARD","module_code":"M4","path_pattern":"/accounting/dashboard","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING","module_code":"M4","path_pattern":"/accounting","parent_menu_code":null},{"menu_code":"MENU_ACCOUNTING_LEDGER","module_code":"M4","path_pattern":"/accounting/ledger","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_INCOME_STATEMENT","module_code":"M4","path_pattern":"/accounting/income-statement","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_TRIAL_BALANCE","module_code":"M4","path_pattern":"/accounting/trial-balance","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_BALANCE_SHEET","module_code":"M4","path_pattern":"/accounting/balance-sheet","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_AUDITORIA","module_code":"M4","path_pattern":"/accounting/auditoria","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_SALES_COBRANZAS","module_code":"M7","path_pattern":"/sales/cobranzas","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_COLLECTIONS","module_code":"M7","path_pattern":"/collections","parent_menu_code":null},{"menu_code":"MENU_PURCHASES_EXPENSES","module_code":"M8","path_pattern":"/purchases/expenses","parent_menu_code":"MENU_PURCHASES"},{"menu_code":"MENU_EXPENSES","module_code":"M4","path_pattern":"/expenses","parent_menu_code":null},{"menu_code":"MENU_ACCOUNTING_RULES","module_code":"M4","path_pattern":"/accounting/rules","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_GUIA","module_code":"M4","path_pattern":"/accounting/guia","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_PLAN_CUENTAS","module_code":"M4","path_pattern":"/accounting/plan-cuentas","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_PERIODS","module_code":"M4","path_pattern":"/accounting/periods","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_TAX_BOOKS","module_code":"M4","path_pattern":"/accounting/tax-books","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_PLE","module_code":"M4","path_pattern":"/accounting/ple","parent_menu_code":"MENU_ACCOUNTING"}]'::jsonb) AS e(menu_code text,module_code text,path_pattern text,parent_menu_code text) ON e.menu_code=d.menu_code WHERE e.menu_code IS NULL OR (d.module_code,d.path_pattern,d.parent_menu_code) IS DISTINCT FROM(e.module_code,e.path_pattern,e.parent_menu_code)) THEN RAISE EXCEPTION 'Catálogo de menús incompatible'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset('[{"menu_code":"MENU_INVOICES_DASHBOARD","module_code":"M1","path_pattern":"/invoices/dashboard","parent_menu_code":null},{"menu_code":"MENU_INVOICES_DETRACCIONES","module_code":"M1","path_pattern":"/invoices/detracciones","parent_menu_code":null},{"menu_code":"MENU_INVOICES_REPORTES_VENTAS","module_code":"M1","path_pattern":"/invoices/reportes/ventas","parent_menu_code":null},{"menu_code":"MENU_INVOICES_FACTURAS","module_code":"M1","path_pattern":"/invoices/facturas","parent_menu_code":null},{"menu_code":"MENU_INVOICES_CLIENTES","module_code":"M1","path_pattern":"/invoices/clientes","parent_menu_code":null},{"menu_code":"MENU_INVOICES_EMISION","module_code":"M1","path_pattern":"/invoices/emision","parent_menu_code":null},{"menu_code":"MENU_INVOICES_NOTAS","module_code":"M1","path_pattern":"/invoices/notas","parent_menu_code":null},{"menu_code":"MENU_INVOICES_BAJAS","module_code":"M1","path_pattern":"/invoices/bajas","parent_menu_code":null},{"menu_code":"MENU_INVOICES_MONITOR","module_code":"M1","path_pattern":"/invoices/monitor","parent_menu_code":null},{"menu_code":"MENU_INVOICES_CONFIGURACION","module_code":"M1","path_pattern":"/invoices/configuracion","parent_menu_code":null},{"menu_code":"MENU_INVOICES_CONFIGURACION_PRECIOS","module_code":"M1","path_pattern":"/invoices/configuracion/precios","parent_menu_code":"MENU_INVOICES_CONFIGURACION"},{"menu_code":"MENU_USUARIOS_ALMACENES","module_code":"M9","path_pattern":"/usuarios/almacenes","parent_menu_code":null},{"menu_code":"MENU_USUARIOS_PERMISOS","module_code":"M9","path_pattern":"/usuarios/permisos","parent_menu_code":null},{"menu_code":"MENU_SALES","module_code":"M7","path_pattern":"/sales","parent_menu_code":null},{"menu_code":"MENU_SALES_POS","module_code":"M7","path_pattern":"/sales/pos","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_HISTORIAL","module_code":"M7","path_pattern":"/sales/historial","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_DEVOLUCIONES","module_code":"M7","path_pattern":"/sales/devoluciones","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_COTIZACIONES","module_code":"M7","path_pattern":"/sales/cotizaciones","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_PEDIDOS","module_code":"M7","path_pattern":"/sales/pedidos","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_CAJA","module_code":"M7","path_pattern":"/sales/caja","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_SALES_REPORTES","module_code":"M7","path_pattern":"/sales/reportes","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_CUSTOMS","module_code":"M2","path_pattern":"/customs","parent_menu_code":null},{"menu_code":"MENU_CUSTOMS_DASHBOARD","module_code":"M2","path_pattern":"/customs/dashboard","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_ORDERS","module_code":"M2","path_pattern":"/customs/orders","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_SUPPLIERS","module_code":"M2","path_pattern":"/customs/suppliers","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_PARTNERS","module_code":"M2","path_pattern":"/customs/partners","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_CONFIG","module_code":"M2","path_pattern":"/customs/config","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_SHIPMENTS","module_code":"M2","path_pattern":"/customs/shipments","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_SHIPMENTS_ID","module_code":"M2","path_pattern":"/customs/shipments/:id","parent_menu_code":"MENU_CUSTOMS_SHIPMENTS"},{"menu_code":"MENU_CUSTOMS_DECLARATIONS","module_code":"M2","path_pattern":"/customs/declarations","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_DECLARATIONS_NEW","module_code":"M2","path_pattern":"/customs/declarations/new","parent_menu_code":"MENU_CUSTOMS_DECLARATIONS"},{"menu_code":"MENU_CUSTOMS_SETTLEMENTS","module_code":"M2","path_pattern":"/customs/settlements","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_LANDED_COST","module_code":"M2","path_pattern":"/customs/landed-cost","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_SHIPMENTS_ID_LANDED_COST","module_code":"M2","path_pattern":"/customs/shipments/:id/landed-cost","parent_menu_code":"MENU_CUSTOMS_SHIPMENTS_ID"},{"menu_code":"MENU_CUSTOMS_ACCOUNTING","module_code":"M2","path_pattern":"/customs/accounting","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_INVENTORY_KARDEX","module_code":"M2","path_pattern":"/customs/inventory/kardex","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_CUSTOMS_LEGACY","module_code":"M2","path_pattern":"/customs/legacy","parent_menu_code":"MENU_CUSTOMS"},{"menu_code":"MENU_PURCHASES_DASHBOARD","module_code":"M8","path_pattern":"/purchases/dashboard","parent_menu_code":"MENU_PURCHASES"},{"menu_code":"MENU_PURCHASES_PAYABLES","module_code":"M8","path_pattern":"/purchases/payables","parent_menu_code":"MENU_PURCHASES"},{"menu_code":"MENU_PURCHASES","module_code":"M8","path_pattern":"/purchases","parent_menu_code":null},{"menu_code":"MENU_PURCHASES_ORDERS","module_code":"M8","path_pattern":"/purchases/orders","parent_menu_code":"MENU_PURCHASES"},{"menu_code":"MENU_INVENTORY_DASHBOARD","module_code":"M6","path_pattern":"/inventory/dashboard","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_STOCKS","module_code":"M6","path_pattern":"/inventory/stocks","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_MOVEMENTS","module_code":"M6","path_pattern":"/inventory/movements","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_TRANSFERS","module_code":"M6","path_pattern":"/inventory/transfers","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_ADJUSTMENTS","module_code":"M6","path_pattern":"/inventory/adjustments","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_OPENING","module_code":"M6","path_pattern":"/inventory/opening","parent_menu_code":null},{"menu_code":"MENU_INVENTORY_CONFIG","module_code":"M6","path_pattern":"/inventory/config","parent_menu_code":null},{"menu_code":"MENU_KARDEX_GENERAL","module_code":"M6","path_pattern":"/kardex/general","parent_menu_code":null},{"menu_code":"MENU_KARDEX_PRODUCTO","module_code":"M6","path_pattern":"/kardex/producto","parent_menu_code":null},{"menu_code":"MENU_SIRE_CONFIGURACION","module_code":"M3","path_pattern":"/sire/configuracion","parent_menu_code":null},{"menu_code":"MENU_SIRE_IMPORTAR","module_code":"M3","path_pattern":"/sire/importar","parent_menu_code":null},{"menu_code":"MENU_SIRE_PERIODOS","module_code":"M3","path_pattern":"/sire/periodos","parent_menu_code":null},{"menu_code":"MENU_SIRE_CONCILIACION","module_code":"M3","path_pattern":"/sire/conciliacion","parent_menu_code":null},{"menu_code":"MENU_SIRE_CIERRE","module_code":"M3","path_pattern":"/sire/cierre","parent_menu_code":null},{"menu_code":"MENU_SIRE_HISTORIAL","module_code":"M3","path_pattern":"/sire/historial","parent_menu_code":null},{"menu_code":"MENU_ACCOUNTING_DASHBOARD","module_code":"M4","path_pattern":"/accounting/dashboard","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING","module_code":"M4","path_pattern":"/accounting","parent_menu_code":null},{"menu_code":"MENU_ACCOUNTING_LEDGER","module_code":"M4","path_pattern":"/accounting/ledger","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_INCOME_STATEMENT","module_code":"M4","path_pattern":"/accounting/income-statement","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_TRIAL_BALANCE","module_code":"M4","path_pattern":"/accounting/trial-balance","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_BALANCE_SHEET","module_code":"M4","path_pattern":"/accounting/balance-sheet","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_AUDITORIA","module_code":"M4","path_pattern":"/accounting/auditoria","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_SALES_COBRANZAS","module_code":"M7","path_pattern":"/sales/cobranzas","parent_menu_code":"MENU_SALES"},{"menu_code":"MENU_COLLECTIONS","module_code":"M7","path_pattern":"/collections","parent_menu_code":null},{"menu_code":"MENU_PURCHASES_EXPENSES","module_code":"M8","path_pattern":"/purchases/expenses","parent_menu_code":"MENU_PURCHASES"},{"menu_code":"MENU_EXPENSES","module_code":"M4","path_pattern":"/expenses","parent_menu_code":null},{"menu_code":"MENU_ACCOUNTING_RULES","module_code":"M4","path_pattern":"/accounting/rules","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_GUIA","module_code":"M4","path_pattern":"/accounting/guia","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_PLAN_CUENTAS","module_code":"M4","path_pattern":"/accounting/plan-cuentas","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_PERIODS","module_code":"M4","path_pattern":"/accounting/periods","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_TAX_BOOKS","module_code":"M4","path_pattern":"/accounting/tax-books","parent_menu_code":"MENU_ACCOUNTING"},{"menu_code":"MENU_ACCOUNTING_PLE","module_code":"M4","path_pattern":"/accounting/ple","parent_menu_code":"MENU_ACCOUNTING"}]'::jsonb) AS e(menu_code text) LEFT JOIN permission_menu_catalog d USING(menu_code) WHERE d.menu_code IS NULL AND e.menu_code<>'MENU_ACCOUNTING_GUIA') THEN RAISE EXCEPTION 'Faltan menús previos'; END IF;
 IF EXISTS(SELECT 1 FROM company_roles WHERE code NOT IN('ADMIN','CONTADOR','OPERADOR_FACTURACION','OPERADOR_ADUANAS','AUDITOR') OR NOT is_system) OR EXISTS(SELECT 1 FROM companies c WHERE (SELECT count(*) FROM company_roles r WHERE r.company_id=c.id)<>5) THEN RAISE EXCEPTION 'Roles de sistema incompletos o propios inesperados'; END IF;
 IF EXISTS(SELECT 1 FROM company_roles r CROSS JOIN permission_menu_catalog m LEFT JOIN role_menu_permissions p ON p.company_id=r.company_id AND p.role_code=r.code AND p.menu_code=m.menu_code WHERE p.menu_code IS NULL AND m.menu_code<>'MENU_ACCOUNTING_GUIA') THEN RAISE EXCEPTION 'Matriz previa incompleta'; END IF;
 END $data$;
INSERT INTO permission_menu_catalog(menu_code,module_code,path_pattern,parent_menu_code) VALUES('MENU_ACCOUNTING_GUIA','M4','/accounting/guia','MENU_ACCOUNTING') ON CONFLICT(menu_code) DO NOTHING;
INSERT INTO role_menu_permissions(company_id,role_code,menu_code,can_view) SELECT company_id,code,'MENU_ACCOUNTING_GUIA',code IN('ADMIN','CONTADOR','AUDITOR') FROM company_roles WHERE is_system ON CONFLICT DO NOTHING;
COMMIT;

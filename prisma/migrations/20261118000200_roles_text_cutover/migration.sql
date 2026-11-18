-- Conversión conservadora de roles; requiere la ventana coordinada y escritores enum drenados.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
LOCK TABLE public.companies, public.company_roles, public.permission_menu_catalog,
 public.role_menu_permissions, public.users, public.role_module_permissions,
 public.role_action_permissions IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
 IF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid='public."Role"'::regtype) IS DISTINCT FROM ARRAY['ADMIN','CONTADOR','OPERADOR_FACTURACION','OPERADOR_ADUANAS','AUDITOR']::text[] THEN RAISE EXCEPTION 'Enum Role incompatible'; END IF;
 IF (SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relkind IN('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped AND a.atttypid IN('public."Role"'::regtype,'public."Role"[]'::regtype))<>3 THEN RAISE EXCEPTION 'Dependencias de Role no previstas'; END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid IN ('public.users'::regclass,'public.role_module_permissions'::regclass,'public.role_action_permissions'::regclass) AND attname='role' AND NOT attisdropped AND atttypid='public."Role"'::regtype)<>3 THEN RAISE EXCEPTION 'Se requieren las tres columnas enum previas'; END IF;
 IF EXISTS(SELECT 1 FROM (SELECT company_id,role::text role FROM users UNION ALL SELECT company_id,role::text FROM role_module_permissions UNION ALL SELECT company_id,role::text FROM role_action_permissions) s LEFT JOIN company_roles r ON r.company_id=s.company_id AND r.code=s.role WHERE r.code IS NULL) THEN RAISE EXCEPTION 'Rol huérfano en su empresa'; END IF;
 IF EXISTS(SELECT 1 FROM companies c WHERE c.is_active AND EXISTS(SELECT 1 FROM users u WHERE u.company_id=c.id AND u.is_active) AND NOT EXISTS(SELECT 1 FROM users u WHERE u.company_id=c.id AND u.is_active AND u.role::text='ADMIN')) THEN RAISE EXCEPTION 'Empresa sin ADMIN activo'; END IF;
END $$;
ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'OPERADOR_FACTURACION';
ALTER TABLE public.role_module_permissions ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.role_action_permissions ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.users ADD CONSTRAINT users_company_id_role_fkey FOREIGN KEY(company_id,role) REFERENCES public.company_roles(company_id,code) ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.role_module_permissions ADD CONSTRAINT role_module_permissions_company_id_role_fkey FOREIGN KEY(company_id,role) REFERENCES public.company_roles(company_id,code) ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.role_action_permissions ADD CONSTRAINT role_action_permissions_company_id_role_fkey FOREIGN KEY(company_id,role) REFERENCES public.company_roles(company_id,code) ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT users_company_id_role_fkey;
ALTER TABLE public.role_module_permissions VALIDATE CONSTRAINT role_module_permissions_company_id_role_fkey;
ALTER TABLE public.role_action_permissions VALIDATE CONSTRAINT role_action_permissions_company_id_role_fkey;
DROP TYPE public."Role";
COMMIT;

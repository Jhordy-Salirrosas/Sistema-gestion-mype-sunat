-- Reversa exclusiva de expansión, antes del corte y sin uso del mantenedor.
-- Drenar la aplicación nueva; exportar catálogo y permisos antes de ejecutar.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.company_roles, public.permission_menu_catalog, public.role_menu_permissions IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.company_roles WHERE NOT is_system) THEN
  RAISE EXCEPTION 'Hay roles propios: no se puede revertir automáticamente';
 END IF;
 IF EXISTS (SELECT 1 FROM public.audit_logs WHERE module='M0_AUTH' AND action LIKE 'ROLE_%') THEN
  RAISE EXCEPTION 'Hay cambios de roles/permisos auditados: revisar/exportar antes de revertir';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid IN ('public.users'::regclass,'public.role_module_permissions'::regclass,'public.role_action_permissions'::regclass) AND attname='role' AND atttypid<>'public."Role"'::regtype) THEN
  RAISE EXCEPTION 'El corte de texto ya ocurrió: usar plan de reversa del corte';
 END IF;
END $$;
DROP TABLE public.role_menu_permissions;
DROP TABLE public.permission_menu_catalog;
DROP TABLE public.company_roles;
COMMIT;

-- Cierra el acceso público a las tablas del negocio.
--
-- El rol `anon` de Supabase (el que usa cualquier cliente con la clave pública)
-- conservaba SELECT, INSERT, UPDATE, DELETE y TRUNCATE sobre las 114 tablas de
-- public, y sólo 5 tenían RLS activo. En la práctica, cualquiera con esa clave
-- podía leer o borrar datos saltándose el backend NestJS por PostgREST o GraphQL.
--
-- El backend se conecta como el rol `postgres`, que es dueño de las tablas y no
-- depende de estos permisos, así que revocarlos no afecta a la aplicación.
-- La subida de archivos usa el esquema `storage`, que no se toca aquí.
--
-- `anon` y `authenticated` sólo existen en Supabase. En una base limpia (CI,
-- PostgreSQL local) no existen, y un REVOKE directo falla con
-- «role "anon" does not exist», tumbando el `migrate deploy`. Por eso se revoca
-- con SQL dinámico únicamente cuando el rol está presente.
--
-- Si algún día se necesita acceso directo desde el navegador, se vuelve a
-- conceder de forma explícita y por tabla:
--   GRANT SELECT ON "products" TO anon;

DO $$
DECLARE
  rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY['anon', 'authenticated']::text[] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', rol);

      -- Evita que las tablas futuras vuelvan a heredar estos permisos.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', rol);
    END IF;
  END LOOP;
END
$$;

# Contrato de corte — esquema activo texto/FK

La parte 5 activa `prisma/schema/auth.prisma`: tres columnas de rol de usuario
como String, tres relaciones compuestas (company_id, role) a CompanyRole y
retiro del enum Role. `auth.prisma` en esta carpeta conserva una referencia del
mismo contrato, no un segundo esquema que deba desplegarse.

Las migraciones normales son `20261118000100_roles_expansion_adoption` y
`20261118000200_roles_text_cutover`. La primera adopta la expansión existente
(o la crea al reproducir desde cero) y completa únicamente el menú de guía.
La segunda convierte con USING y valida todas las FK dentro de su transacción.
Las tres FK de expansión conservan ON UPDATE NO ACTION; las de rol compuesto
usan RESTRICT. No usar diff automático, db push ni reset para sustituirlas.

El paquete construye el artefacto, pero no ejecuta la ventana ni habilita roles
propios. ROLES_CUSTOM_ENABLED permanece bajo control de la ventana aprobada.
Drenar el runtime enum y todos sus escritores antes de aplicar las migraciones;
no basta con dejar el flag apagado. Consultar docs/m1/roles-cutover-parte5.md.

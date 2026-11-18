# Roles administrables — construcción de parte 5

## Alcance y bases

Se construye el artefacto de corte aprobado en la fase 0 `6b39e702`:
`docs/roles-cutover-fase0`, documento `docs/m1/roles-cutover-fase0.md` de esa rama.
Back: `feat/roles-cutover` desde main
`d4d362f602452caee2ae26648d3971597904d4c4`, PR de revisión hacia dev.
Front: ferry separado `ferry/roles-cutover-front`, sobre main CarlosSoles
`9d188381c0f63c13143576f499b0b58d0f23f9bd`.

**No se ejecuta la ventana ni la habilitación.** No se despliega, no se hace
merge ni se consulta/modifica producción o una base compartida. No cambia
ROLES_CUSTOM_ENABLED en Render ni en configuración de despliegue. Solo las
pruebas locales alternan su entorno aislado para certificar ambas compuertas.
Se usó PostgreSQL 16 efímero, ligado a 127.0.0.1, como el servicio de CI.

La base back coincide con fase 0. El front avanzó desde `21c662f`; se conserva
su main actual para no sobrescribir cambios de navegación/contabilidad del
equipo. Esta actualización de base no amplía el delta funcional aprobado.

## Migraciones definitivas

1. `20261118000100_roles_expansion_adoption`:
   transacción, lock_timeout de 5 s y statement_timeout de 120 s; crea la
   expansión al reproducir desde cero o adopta las tres tablas existentes.
   Aborta ante existencia parcial, columnas/defaults/PK/FK/CHECK distintos,
   catálogos inesperados o matriz histórica incompleta. Los contratos
   existentes se comparan sin sobrescribirlos. Solo completa el menú guía y
   sus cinco permisos por empresa cuando faltan; conserva filas ya presentes,
   renombres y denegaciones, incluidos overrides ADMIN.
2. `20261118000200_roles_text_cutover`:
   repite preflight de enum, dependencias y pertenencia; toma locks explícitos;
   elimina temporalmente el default de users.role, convierte las tres columnas
   con `TYPE text USING role::text`, repone el default y añade las FK compuestas.
   NOT VALID y VALIDATE ocurren dentro de la misma transacción; DROP TYPE Role
   es la última operación de esquema y no usa CASCADE. No borra/recrea columnas,
   no modifica las otras 80 migraciones ni incluye el diff global destructivo.

Las FK se denominan users_company_id_role_fkey,
role_module_permissions_company_id_role_fkey y
role_action_permissions_company_id_role_fkey; apuntan de (company_id,role) a
company_roles(company_id,code), con UPDATE/DELETE RESTRICT. Los ocho índices de
usuarios/módulos/acciones mantienen nombres, columnas y unicidad.

El esquema activo y su referencia en prisma/cutover usan tres roles String,
las relaciones inversas y las tres relaciones de expansión con NoAction
explícito (empresa del catálogo, padre de menú y menú del permiso). Se retira
el enum y sus puentes de tipado de rol. npm build genera src/generated/client
texto y compila el mismo cliente en dist, también usado por el worker. No se
versionan archivos generados: npm ci/postinstall y npm build los regeneran
usando el esquema activo del artefacto. La prueba de esquema ya valida este
contrato activo y asegura que no lo modifica ni conecta una base compartida.

## Compuerta de habilitación

Se mantiene el requisito de ROLES_CUSTOM_ENABLED exactamente igual a true.
Además de las tres columnas role text NOT NULL, la consulta PostgreSQL exige
para cada una:

- FK de la tabla concreta al catálogo public.company_roles.
- Columnas origen exactas y ordenadas (company_id, role).
- Columnas destino exactas y ordenadas (company_id, code).
- Constraint validada, no diferible, UPDATE y DELETE RESTRICT.

No basta con encontrar cualquier FK de dos columnas. Las pruebas alteran cada
componente en DB: ausencia, NOT VALID, orden inverso, origen/destino distintos,
acción CASCADE, diferibilidad, nulabilidad y varchar. Todas cierran la compuerta.
El flag apagado sigue evitando la consulta y la creación/asignación propias.
No se concede ningún privilegio por nombre visible ni se cambian defaults de
los cinco roles de sistema, guards, restricciones de almacenes o administración.

## Batería automatizada

La integración nueva usa TEST_DATABASE_URL, que CI ya proporciona. Crea bases
aleatorias solo en PostgreSQL local, copia las migraciones históricas anteriores
al corte y aplica las dos finales mediante Prisma normal; no cambia el historial
manualmente. El árbol del cliente activo permanece texto durante los ensayos.

Sus 20 casos cubren:

- Expansión preexistente de 72 y de 73 menús; renombre de CONTADOR, denegación
  de menú y overrides de módulo/acción. Huellas antes/después de usuarios y
  permisos históricos idénticas; solo se añaden guía y cinco permisos.
- Snapshots efectivos de los cinco roles antes y después del DDL. Login,
  JWT firmado y refresh real de los cinco roles, con hashes reales de prueba;
  los refresh tokens emitidos antes del DDL siguen utilizables después.
- Instalación desde cero, empresa nueva y cinco roles inicializados antes del
  usuario; journal aplicado y checksums de todas las migraciones coincidentes;
  segunda ejecución sin pendientes.
- Forma parcial/distinta, catálogo alterado y huérfanos: abortan antes de
  convertir, dejan evidencia de fallo en Prisma y un reintento no la salta.
- Fallo simulado después de la última operación de DDL pero antes de COMMIT:
  se restauran tipo/filas y luego migrate deploy normal funciona. Enum
  inesperado o lock retenido abortan sin una conversión parcial.
- Flag apagado antes/después del DDL; flag true con enum sigue cerrado.
- Cliente texto real crea y asigna un rol propio inicialmente sin permisos.
  Concesiones explícitas de módulo/menú/acción funcionan; configuración sigue
  reservada a ADMIN incluso con override; sesión con claim antiguo usa rol DB;
  autobloqueo y renombre ADMIN se rechazan; la auditoría tiene actor y empresa.
- Predicado exacto de FK, no una simulación basada solo en cardinalidad.

La matriz independiente existente vuelve a ejecutar **6720 decisiones**:
21 puntos × 5 roles × 16 combinaciones de overrides × 4 matrices M1. Conserva
los tres *_ACCESS, la delegación explícita y las reservas administrativas.
Las integraciones adicionales de auth se ejecutan también al definir
ROLES_TEST_DATABASE_URL local: no se omiten por falta de esa variable en la
corrida completa de entrega. No hay nuevos skip ni exclusiones de cobertura.

## Front y ferry

Se retiran las dos listas ADMIN aprobadas de Sidebar para adjustments/opening,
y la metadata/filtro sin usos. No se añade enforcement de inventario en el
back. El snapshot del servidor manda igual en sidebar, paleta y ruta directa.

Esta es la diferencia visible aprobada respecto al filtro local anterior:
los roles de sistema distintos de ADMIN y los roles propios pueden ver esos
enlaces cuando el servidor los concede. No se afirma equivalencia con la
restricción local eliminada; las otras decisiones permanecen gobernadas por el
mismo servidor. Las nueve pruebas nuevas verifican concesión para los cinco
roles y para uno propio, denegación para ADMIN/propio y coincidencia entre las
tres superficies. Las pruebas existentes conservan cinco roles/alias, catálogo
dinámico, carga/error, caché por identidad y renombrado sin logout.

El ferry contiene únicamente Sidebar y su nueva prueba, con FERRY.md y
SHA256SUMS. No se copia el espejo heredado completo ni se borran sus archivos
en el front. La rama del ferry no tiene PR; el PR backend enlaza esta entrega.

## Condiciones de la ventana posterior

Las dos migraciones son ejecutables por el build normal una vez aprobada la
ventana. Este PR no debe tratarse como habilitación ni fusionarse para disparar
un corte sin coordinación. Drenar runtime enum, workers y otros escritores,
compilar correctamente antes del DDL, mantener flag false y certificar tipos,
FK, journal, datos y cinco roles antes de reabrir operaciones.

Un rollback de Git no revierte el esquema. Si el DDL confirmó, conservar un
artefacto texto sano o aplicar una migración compensatoria revisada antes de
volver al binario enum. Después de asignar roles propios, una reversa física
requiere exportación y aprobación de sus referencias; no reasignar/borrar
silenciosamente ni restaurar toda la base perdiendo documentos de negocio.
La parte 6 y la certificación viva quedan fuera de este encargo.

## Desviaciones y observaciones de verificación

- Front actualizado al main `9d18838` para conservar cambios del equipo.
- El checksum manual heredado de expansión no correspondía al SQL que ya
  estaba en main (73 menús). Se recalcula solo ese manifiesto; el SQL manual
  histórico y las 80 migraciones anteriores no se modifican.
- En la primera corrida completa concurrente, la suite existente de
  prevalidación agotó su hook de 5 s (dos pruebas) y su limpieza posterior.
  Repetida sola pasó en 1,829 s sin cambiar límite ni aserciones. Se repite la
  suite completa sin los ensayos concurrentes antes del cierre.

## Resultados de cierre

| Suite completa | Archivos antes → final | Aprobados antes → final | Omitidos antes → final | Pruebas aprobadas antes → final | Pruebas omitidas antes → final | Fallos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Back | 479 → 480 | 469 → 476 | 10 → 4 | 4596 → 4641 | 63 → 38 | 0 → 0 |
| Front | 216 → 217 | 216 → 217 | 0 → 0 | 1586 → 1595 | 0 → 0 | 0 → 0 |

Back: la base es la fase 0 aprobada del mismo SHA. La corrida final activa
ROLES_TEST_DATABASE_URL además de TEST_DATABASE_URL: se ejecutan 25 pruebas
preexistentes antes omitidas y los 20 casos nuevos, no se atribuyen las 45 a
código nuevo. Las cuatro suites/38 pruebas omitidas mantienen sus compuertas
externas originales. Las pruebas nuevas del corte usan TEST_DATABASE_URL y
corren en el CI normal, que ya proporciona PostgreSQL. No se agregan omisiones
ni exclusiones. El back mantiene sus 12 snapshots aprobados.

La corrida dirigida inicial (esquema, catálogo, servicio y migración) aprobó
34 pruebas en cuatro archivos; la batería de migraciones ampliada tiene
20 casos. La limpieza final de puentes de tipado se verifica también con los
unitarios de guard/repository y el build. La última repetición completa del
back con cobertura tiene código 0, sin el timeout transitorio descrito arriba.
Todas las sentencias nuevas de la compuerta quedan cubiertas por unitarias e
integraciones reales. El front dirigido (navegación nueva y roles dinámicos)
aprueba 23 casos en dos archivos.

Builds Prisma/Nest y TypeScript/Vite aprobados. Lint back: cero errores y cuatro
advertencias preexistentes (summaryAggregateStore, summaryPollingCoordinator,
exportPleTxtUseCase y supplierCreditNote). Lint del delta front: cero errores y
la advertencia preexistente del export NAV_ITEMS en Sidebar. Checksums de los
SQL manuales históricos y del ferry verificados.

### Checksums de las migraciones finales

- `20261118000100_roles_expansion_adoption`: `51e6965d8bf66da17fb06ca21cfdc6e7129bb5c037e1dff9cb98986ff303a86d`.
- `20261118000200_roles_text_cutover`: `7f448d3cb9f2586351864372108b7781c010f7bc579232f5bf0ef43a1780480a`.

# Semana Cueva — paquete 4

## Fase 0

Bases autorizadas y verificadas por `git ls-remote`: back dev
`646fa51a9e1862efc9265c529d0d33b81f44d978`; front main
`4fb2d30f841a374ce53efc57d790832b52c68510`.
Rama: `feat/cueva-cierre`, recreada desde la nueva base; reemplaza el informe
anterior que se había detenido por discrepancia de cabezas. No hay merges.

El PR #412 se corrigió primero en su rama: `a806fd0d`, dos suites PostgreSQL,
5 pruebas aprobadas, ninguna omitida. Esta rama no incorpora esa entrega.

### Inspección por punto

| Parte | Estado encontrado y decisión |
| --- | --- |
| P1 | PR #305 ya agregó medio_pago al DTO, payload y ambas entradas de emisión; catálogo incluye efectivo, Yape, Plin, tarjeta, transferencia, depósito y cheque. El puente solo carga CXC; falta clasificar el cobro y configurar el valor global. Se conserva el catálogo compatible y el tratamiento del crédito. |
| P2 | Hay resolución de credenciales y diagnóstico local X.509, sin prueba remota segura en configuración. Agregar diagnóstico beta de lectura, sin emitir/anular ni modificar comprobantes. |
| P3 | Existe input nativo .p12/.pfx y subida JSON cert_base64/cert_password en PUT invoices/config; no está oculto en JSX, pero carece de estilo explícito del botón tras el reset CSS. Hacer visible su acción sin cambiar el contrato. |
| P4 | Las pantallas de configuración existen separadas. Sidebar, appRoutes, roleNavigation y controladores auth/config están en la entrega de roles. Esos archivos quedan detenidos por secuencia; construir únicamente la agrupación y endpoints independientes que no los sobrescriben. |
| P5 | Lista navega al emitir factura/boleta; ya hay modal de notas. CustomerLookupField ya abre PartnerFormDialog y selecciona lo guardado. Reutilizar ese mecanismo y useRucAutofill/consultarDni de Decolecta; no duplicar proveedor ni validación documental del equipo. |
| P6 | ND admite importes positivos y aumenta la operación; deliberadamente no consume saldo (prueba TA-66 explícita). No se declarará ya cumplido el requisito de saldo decreciente. El resultado y su alcance se documentan en esta parte. |
| P7 | Solo diseño de sucursal/caja/serie y plan gradual. |

Los fixtures de fecha invoiceBagsRegistered e invoiceFormValidation usan
hoyLima relativo, no fechas fijas fuera de plazo.

### Protección de la entrega de roles

Se contrastó la entrega `d28ffc8059..a806fd0d` y el inventario de sus 72
archivos de ferry. No se modifican sus fuentes ni pruebas. En particular
`authController.ts`, `invoiceConfigController.ts`, `invoicesController.ts`,
`auth.prisma`, Sidebar, rutas, paleta, atajos y editores de permisos permanecen
fuera de esta entrega. Los manifiestos del ferry describen solo este paquete;
su integración con los del paquete anterior requiere composición secuencial.

### Línea base antes de construir

| Suite completa | Archivos inventariados | Aprobados / fallidos / omitidos | Pruebas aprobadas / fallidas / omitidas |
| --- | --- | --- | --- |
| Back 646fa51a | 435 | 426 / 1 / 8 | 4228 / 1 / 50 (4279 total) |
| Front 4fb2d30 | 367 | 367 / 0 / 0 | 1488 / 0 / 0 |

Back: Node 24, Jest --runInBand, NODE_OPTIONS=--max-old-space-size=4096,
TEST_DATABASE_URL a PostgreSQL 17 local efímero y RUN_INTEGRATION_TESTS=required.
Se ejecutaron las integraciones de Outbox y reintento. El único fallo fue el
umbral de latencia de Outbox: 8/10 respuestas menores a 800 ms mientras corría
también Vitest. No se ajusta ni se oculta ese umbral; se repetirá sin carga
simultánea. Las 8 suites/50 pruebas omitidas son las omisiones declaradas por
la base. Front: npm test -- --reporter=json. Resultados completos en
cueva-back-before.json y cueva-front-before.json del workspace.

## P1 — Medio de pago y configuración comercial

Se conserva el catálogo compatible de PR #305 (incluidos depósito y cheque).
Crédito es la forma fiscal, no un medio de cobro. Se corrigió la conversión de
POST /invoices para conservar medioPago, además del camino /emitir que ya lo
hacía. Las ventas nuevas llevan snapshot m1PaymentAccountingVersion=1: el
puente usa caja 1011 para efectivo y la regla COBRO de la empresa para medios
bancarios; admite mapeos COBRO_YAPE, COBRO_PLIN, COBRO_TARJETA, etc. No inventa
subcuentas: sin cuenta 10 válida deja el puente pendiente con error visible.
El crédito conserva CXC; los documentos/asientos históricos sin snapshot no
se reclasifican. El cobro comercial se registra con clave estable m1-cash:ID,
sin segundo asiento COBRO; su reintento no duplica cobros ni asientos. Se
mantienen separadas detracción y retención.

GET/PUT /invoices/commercial-defaults almacena la forma y el medio por empresa;
solo ADMIN guarda, cualquier emisor autenticado puede leer dentro del módulo.
La tabla aditiva se gestiona por SQL manual (no se cambia auth.prisma, protegido
por la entrega de roles). Sin fila, Contado/Efectivo. La configuración global
sugiere crédito únicamente para factura con cliente habilitado; conserva la
regla de descuentos del maestro. Ambos formularios consumen el valor global.
Un fallo de lectura se informa; no se presume que el cliente concede crédito.

El SQL y checksum están en scripts/manual/cueva-commercial-defaults.*. Se
ensayó solo en el contenedor PostgreSQL local. Las pruebas PostgreSQL verifican
persistencia, aislamiento empresarial, catálogo y PUT con guards reales.
Pruebas dirigidas iniciales: 2 archivos/13 pruebas de back aprobadas; build Nest
aprobado. La suite completa del cierre incluye la cobertura de este cambio.

## P2 — Diagnóstico SUNAT beta

POST /invoices/connection-test exige AuthGuard + RolesGuard ADMIN, toma la
empresa del token y resuelve las credenciales guardadas. Usa únicamente
getStatus con ticket de diagnóstico 0000000000000, endpoint beta fijo,
redirects prohibidos y timeout de 8 segundos. El WSDL beta consultado enumera
getStatus, getStatusAR, sendBill, sendPack y sendSummary; no se presupone
getStatusCdr, ausente en ese contrato. No se emite, anula, consulta documento
real ni se escribe estado fiscal. Las pruebas sustituyen el transporte externo.

La respuesta distingue conexión confirmada, rechazo de credenciales y respuesta
no concluyente; HTTP 200 por sí solo no acredita conexión. Los faults ajenos a
una respuesta getStatus reconocida no se declaran éxito. La validez beta no se
presenta como validación de credenciales de producción. El certificado se
inspecciona localmente y se informa por separado (vigente, vencido, futuro,
inválido o ausente). No se publican SOL, PFX, claves ni cuerpo remoto. La
pantalla muestra resultado, latencia y certificado sin emitir documentos.

## P3 — Selector de certificado visible

El input nativo existente permanece visible y asociado a su etiqueta. Se
agrega estilo explícito al botón file-selector-button para que el reset CSS
no elimine su contraste y superficie de acción. La ayuda indica .pfx/.p12 y
96 KiB. Se reutiliza FileReader y PUT /invoices/config con cert_base64 y
cert_password; no hay endpoint, transporte ni validación nuevos.

## P4 — Agrupación de configuración y archivos detenidos

Se construyó la sección Configuración en la ruta administrativa existente
/invoices/configuracion y GET /configuration/links, protegido por guards
reales ADMIN. Agrupa empresa/SOL/certificado, series, facturación, roles y
accesos, importación, SIRE, plan/períodos y reglas contables de compra/venta.
No existen pantallas independientes de configuración de compras/ventas en
esta base: se enlazan sus reglas existentes COMPRA/VENTA, sin duplicarlas.
Los anchors abren la sección correspondiente de las pantallas existentes.
La UI no consulta ni muestra la agrupación para un rol distinto de ADMIN;
el endpoint responde 403 aunque se invoque directamente.

**Detenido por la regla de secuencia:** el nuevo ítem global de Sidebar y una
ruta global separada exigirían modificar Sidebar.tsx, appRoutes.tsx,
roleNavigation.ts y el catálogo de menús en auth/domain/menuCatalog.ts, todos
en la entrega de roles. No se sobrescriben ni se agrega un catálogo paralelo.
También se conserva invoiceConfigController.ts, compartido por emisión y en
esa entrega: no se bloquean sus lecturas operativas de series/checklist.
La sección queda accesible desde la configuración administrativa ya existente;
el menú global queda pendiente de componer después de la fusión de roles.

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

# Paquete de correcciones de auditoría M1

Entrega única: `fix/m1-paquete-auditoria` en Jhordy-Salirrosas/Sistema-gestion-mype-sunat. Incluye backend en sus rutas y frontend bajo `frontend/`. No se crea rama de entrega ni se empuja al repositorio frontend. Sin PR, despliegues, emisiones reales, acceso a base compartida ni migraciones.

## Bases y alcance

- Backend main: `ddaec671295a043ef4e6a7550c7e25c0ac17770d`.
- Frontend main servido: `04c137fcba62b24e907876e5f646158c92f57461`, CarlosSoles/Fronted-sistema-mype-sunat.
- Fase 0 y decisiones: [docs/m1/auditoria-solucion.md](docs/m1/auditoria-solucion.md), sección «Paquete de auditoría M1 — fase 0». Las secciones anteriores se preservan.
- El punto 2 está detenido completo: R.S. 203-2003 regula percepciones de importación; R.S. 037-2002 regula retenciones y la orientación oficial exige documentos separados por operaciones gravadas/no gravadas. El defecto de retención sobre exoneradas/inafectas queda pendiente y el ejemplo mixto no se presenta como una operación normativamente validada. No se modifica esa base ni su umbral en este paquete.
- Los puntos 4 y 6 no cambian código productivo porque las premisas no se sostienen en las bases: existen POST/GET y almacenamiento de bancos; existe estado vacío separado de carga. Las pruebas con dobles no demuestran la causa de incidentes externos ni certifican el estado de la base desplegada.
- El punto 5 corrige la creación del contacto cuando solo hay email/teléfono. El teléfono ya se transporta y persiste en el código base; su pérdida histórica no se reprodujo y no se modifica un tercero real.
- En fecha se ajusta factura 01. Boleta conserva exactamente su regla y texto actuales por instrucción; notas conservan el comportamiento previo. La etiqueta 2957 del texto heredado se documenta como tal: el catálogo local la refiere a baja, no al plazo de factura. Factura usa tres días conforme a R.S. 000003-2023 y el rechazo 2108 del catálogo.

## Aplicación y verificación del ferry

1. Desde la raíz de esta rama, ejecutar `sha256sum -c SHA256SUMS` antes de copiar archivos. El manifiesto cubre cada archivo de front transportado y este documento; no se incluye a sí mismo.
2. Revisar e integrar la rama backend por el tren habitual. Promover el backend antes o junto con el front para que el indicador del maestro no vuelva a producir retención simultánea con SPOT. No hay cambios de contrato, dependencias ni esquema.
3. Preparar el destino frontend sobre el SHA main indicado. Copiar cada archivo de `frontend/` a la misma ruta relativa del repo front, retirando solamente ese prefijo. Son archivos completos: si main avanzó, comparar e integrar los cambios posteriores antes de reemplazar.
4. Ejecutar en cada repositorio `npm ci`, la suite completa y luego `npm run build`, sin ejecutar el build junto con Jest. Back: `NODE_OPTIONS=--max-old-space-size=6144 npm test -- --runInBand`. Front: `npm test`. No configurar variables de integración ni credenciales reales para estas pruebas.
5. Revisar los commits por punto y aplicar por el flujo de revisión y promoción habitual. No se solicita ni ejecuta creación de PR.

## Validación final

| Verificación | Base | Final |
|---|---:|---:|
| Back: suites aprobadas | 343 | 346 (+3) |
| Back: pruebas aprobadas | 3461 | 3477 (+16) |
| Back: optativas omitidas | 17 suites / 93 pruebas | 17 suites / 93 pruebas |
| Back: snapshots | 12 | 12 |
| Front: archivos aprobados | 170 | 176 (+6) |
| Front: pruebas aprobadas | 1318 | 1345 (+27) |

Cero fallos en las dos suites completas finales. Builds de ambos repositorios correctos, secuenciales y posteriores a Jest. No se ejecutaron pruebas SUNAT beta habilitadas por credenciales ni emisiones reales.

Lint backend sin errores, con tres advertencias preexistentes. ESLint en los archivos front modificados reproduce exactamente tres errores y tres advertencias de la base intacta 04c137fc (effects/ref de React y Fast Refresh); no se amplía alcance para corregirlos. El nuevo formateador pasa ESLint. No se declara el lint global frontend como verde.

El ferry transporta 22 archivos frontend (13 productivos y 9 archivos de pruebas, incluidos ajustes de regresiones existentes), comprobados byte a byte contra el checkout final probado. SHA256SUMS incluye los 22 y este FERRY.md.

## Commits y archivos por punto

La auditoría se actualiza en todos los puntos. Las rutas `frontend/...` tienen como destino la misma ruta sin ese prefijo. Se enumeran tanto producción como pruebas y fixtures.

### Punto 1 — Corregido: exclusión SPOT/retención

Commit `5c4c6d431c239856ef3053ebb80da09aa2cb1e87`.

- `docs/m1/auditoria-solucion.md`
- `frontend/src/modules/invoices/components/InvoiceEmitModal.tsx`
- `frontend/src/modules/invoices/components/InvoiceEmitResumen.tsx`
- `frontend/src/modules/invoices/components/RetencionMaestro.tsx`
- `frontend/src/modules/invoices/lib/invoiceEmitPayload.ts`
- `frontend/src/modules/invoices/lib/invoiceFlujoPago.ts`
- `frontend/src/modules/invoices/lib/invoiceRetentions.ts`
- `frontend/src/modules/invoices/pages/InvoiceEmissionPage.tsx`
- `frontend/test/unit/modules/invoices/invoiceRetencionUnificada.test.tsx`
- `frontend/test/unit/modules/invoices/invoiceSpotCentimos.test.tsx`
- `frontend/test/unit/modules/invoices/paqueteSpotRetencion.test.tsx`
- `src/modules/invoices/application/services/emitirComprobanteAdapter.ts`
- `src/modules/invoices/ublTotalesHelper.ts`
- `test/fixtures/m1-paquete-regimenes-hashes.json`
- `test/unit/invoices/m1-retencion-unificada.spec.ts`
- `test/unit/invoices/m1-spot-credito-regresion.spec.ts`
- `test/unit/invoices/paqueteSpotRetencion.spec.ts`

### Punto 2 — Detenido: contradicción normativa y documento mixto

Commit `22f75f8cf347fe637853f5be9ea9c0bdc04cafff`.

- `docs/m1/auditoria-solucion.md`

### Punto 3 — Corregido: factura 3 días / boleta conserva 7

Commit `8ace081a58d1ddea8b49751245c76332a997c125`.

- `docs/m1/auditoria-solucion.md`
- `frontend/src/modules/invoices/components/InvoiceEmitCampos.tsx`
- `frontend/src/modules/invoices/components/InvoiceEmitModal.tsx`
- `frontend/src/modules/invoices/lib/invoiceEmitFecha.ts`
- `frontend/src/modules/invoices/pages/InvoiceEmissionPage.tsx`
- `frontend/test/unit/modules/invoices/invoiceCazaForm.test.tsx`
- `frontend/test/unit/modules/invoices/paqueteFechaTipo.test.tsx`

### Punto 4 — Sin cambio productivo: persistencia existente; causa externa no confirmada

Commit `20524b39a0991046217a10ee3094efd64e1f74ec`.

- `docs/m1/auditoria-solucion.md`
- `frontend/test/unit/modules/invoices/paqueteBancos.test.tsx`
- `test/unit/customs/paqueteBancos.spec.ts`

### Punto 5 — Corregido contacto principal; pérdida de teléfono no reproducida

Commit `a2ad50b28129a199c079ad08c8746cfb305a48cf`.

- `docs/m1/auditoria-solucion.md`
- `frontend/test/unit/modules/invoices/paqueteContactoAlta.test.tsx`
- `src/modules/customs/application/services/masterDataService.ts`
- `test/unit/customs/paqueteContactoPrincipal.spec.ts`

### Punto 6 — Sin cambio productivo: estado vacío ya presente

Commit `52e377b05a4ac5c6ab97c88f77c7517adae0c399`.

- `docs/m1/auditoria-solucion.md`
- `frontend/test/unit/modules/invoices/paqueteBusquedaVacia.test.tsx`

### Punto 7 — Corregido: etiquetas humanas de pago

Commit `f43d05b280223a201af5fba7a2838a3ca629b219`.

- `docs/m1/auditoria-solucion.md`
- `frontend/src/modules/customs/components/PartnerDetailDrawer.tsx`
- `frontend/src/modules/customs/components/PartnerFormDialog.tsx`
- `frontend/src/modules/customs/lib/paymentTerms.ts`
- `frontend/src/modules/customs/pages/PartnersPage.tsx`
- `frontend/test/unit/modules/invoices/paquetePaymentTerms.test.tsx`

## Límites y reversión

Pruebas nuevas exclusivamente con dobles de API/almacenamiento y fixtures locales. Los hashes del punto 1 se obtuvieron en un checkout separado de la base backend: comparan todos los bytes de la respuesta serializada del adaptador y del XML en SPOT solo y retención sola. Las cuotas que antes restaban ambos regímenes se actualizan para validar el neto correcto; un fixture de emisión se fecha hoy en Lima para seguir probando el rechazo funcional dentro de la ventana nueva.

El punto 2 permanece como defecto conocido, no queda certificado como corregido. El guardado de bancos se verifica en código y con dobles; no se afirma que el incidente externo haya sido necesariamente de sesión. No se aplican migraciones aunque exista deriva en la base compartida.

Para retirar el paquete, revertir su integración y la aplicación de los archivos frontend en el tren correspondiente. No hay datos migrados, credenciales nuevas ni documentos históricos reescritos por esta entrega.

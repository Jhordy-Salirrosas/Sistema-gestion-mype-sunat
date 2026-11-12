# Ferry — RUC propio del emisor M1

Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
Rama: `ferry/m1-ruc-emisor-propio`.
Destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
Base front: `ee5086b592761632ed4d2ebbdbb12fb5e497544f`.
Back asociado: `fix/m1-ruc-emisor-propio`, sobre `40b77ce9f15bd72207f1e085087610ab5ddadc8e`.

Esta rama transporta un árbol del front. Aplicar su commit al front desde la base indicada; no fusionarlo con el árbol del back. FERRY.md se excluye de producción.

## Alcance

Solo cambian tres archivos de producción: identidad de exportación, PDF local y QR del modal. Se consulta `/invoices/config`, el mismo recurso de Configuración, y se usa su `ruc` efectivo. Si la configuración no responde o no proporciona un RUC utilizable, se conserva el respaldo de la empresa de sesión. La identidad compartida de la sesión no se modifica. No hay caché de identidad entre tenants: se descartan respuestas si cambia la empresa o el token. El QR espera la resolución y el PDF utiliza una sola identidad para membrete y trama. Los formateadores puros siguen admitiendo el respaldo de sesión; el acceso público `rucEmisorActual()` ahora es asíncrono y consulta el RUC efectivo (sin consumidores previos en el repositorio).

El formulario del emisor conserva el RUC de solo lectura. El nuevo checklist del back muestra el origen sin cambios de formulario. No se modifican archivos de SIRE ni su identidad. Se añade un único archivo de regresiones del front.

## Verificación

| Suite completa | Línea base | Final |
|---|---|---|
| Back Jest | 326 aprobadas / 4 omitidas; 3155 pruebas aprobadas / 38 omitidas | 327 aprobadas / 4 omitidas; 3191 pruebas aprobadas / 38 omitidas |
| Front Vitest | 150 archivos / 1091 pruebas aprobadas | 151 archivos / 1105 pruebas aprobadas |

El back conserva 12 snapshots aprobados. Se añaden 36 pruebas back y 14 front. Cobertura local del código nuevo del back: 24/24 líneas ejecutables y 39/39 ramas. Builds Nest y Vite, incluido `tsc -b`, aprobados. Lint focal front sin errores; lint back sin errores, con dos avisos previos en resúmenes.

## Migración asociada del back

Archivo: `prisma/migrations/20261112190000_m1_issuer_ruc/migration.sql`.
SHA-256: `7fc7787c92bea3da0decee43d928f82cd6e2c5c43d5c4c6c86757f43eebad5c4`.

```sql
ALTER TABLE "companies" ADD COLUMN "issuer_ruc" VARCHAR(11);
```

Nullable, sin default ni relleno. Pendiente de aplicación manual registrada en la base compartida antes de desplegar el nuevo cliente Prisma; solo se probó en PostgreSQL local aislado. No se ejecutaron PRs, despliegues ni emisiones reales.

## SHA-256 de archivos finales

FERRY.md se excluye de su propia tabla para evitar circularidad.

| Archivo | SHA-256 |
|---|---|
| `src/modules/invoices/components/InvoiceCdrModal.tsx` | `83fa7313952d40e6f7d2b7923175731a0b4ae69df75b283df59e039fe403ce08` |
| `src/modules/invoices/lib/invoiceExportConstants.ts` | `56a27569c1e775086eea960551e29c0d7c24877a01303a3867803f8debe32cd9` |
| `src/modules/invoices/lib/invoiceExportPdf.ts` | `b0597e1de5a9fae60a4f3adb13ada1b51fde25c22d9f579e2237be9380742385` |
| `test/unit/modules/invoices/invoiceIssuerRucPin.test.tsx` | `f120ecb196776f051fe5e0ee478f3d096f5377f24cb4eaec9af01356d40546e4` |

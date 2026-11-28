# M1 — Cruce de documento y nombre del receptor

## Bases y destino

- Repositorio front: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base exacta: `main`, `86c54eceb302855caa16bb35f7f539d7ec2abe40`, que ya incorpora las correcciones de cantidad y cuenta BN. No aplicar sobre la referencia anterior `e434cc6`.
- No se han creado commits en el repositorio front: el trabajo se preparó en un checkout separado y sin rama, con HEAD conservado en la base indicada.
- Rama front sugerida para la aplicación: `fix/m1-cruce-ruc-razon-social`.
- Transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, rama `ferry/m1-cruce-ruc-razon-social`, sobre la base limpia de transporte `07ea5ff9d87b68512209f5da8a2ed862edd94268`. No hay cambios de backend.

## Diagnóstico confirmado antes de construir

`InvoiceEmissionPage` y la sección Notas de `InvoiceList` comparten `InvoiceEmissionForm`. `CustomerLookupField` resuelve las sugerencias mediante `masterDataApi.getPartners({role:'CLIENTE', q:texto})`, mostrando clientes activos; también existe autocompletado RUC/DNI mediante `useRucAutofill`.

La selección rellena documento y nombre. Ya existía una protección parcial: `editarIdentidadCliente` limpia el documento al editar el nombre de una selección confirmada, y limpia el nombre al editar su documento. Se conserva esa protección y la UX del autocompletado.

Antes del cambio, `invoiceFormIssues` validaba formato del documento y contenido del nombre, pero no su correspondencia con el maestro. Las guardas de notas comprobaban el origen, cliente, saldos y cantidades, sin cruzar el nombre contra el maestro. Por tanto, faltaba el cruce antes de revisar y emitir.

## Comportamiento

- La comparación se aplica al receptor del formulario compartido: Factura, Boleta con RUC o DNI y Notas. Solo considera el mismo tipo y número de documento; no toma coincidencias parciales.
- Se toleran mayúsculas/minúsculas, espacios múltiples y tildes mediante normalización Unicode. La puntuación no se elimina y no se utiliza comparación aproximada.
- Si el documento está registrado y el nombre discrepa, se bloquea la revisión y la confirmación con el nombre registrado. Ejemplo: `La razón social no coincide con la registrada para el RUC 20100070970: FERRETERÍA LOS ANDES S.A.C.`. Para DNI se muestra el mensaje equivalente de nombre y DNI.
- Si no hay coincidencia exacta confirmada en el maestro, no se añade un bloqueo: el receptor ocasional sigue su flujo habitual.
- El cruce pertenece a las incidencias comprobadas antes de abrir la revisión y antes de enviar. Si surge una discrepancia durante la revisión, la confirmación vuelve al formulario y muestra el error, sin emitir.
- No se reescribe el nombre indicado ni se cambia el payload. La selección del maestro, edición de identidad, revisión, borrador, atajos, cálculos y demás validaciones se conservan.

## Fuente mínima de datos

Se reutiliza el nombre de la selección confirmada del maestro cuando tiene ID, tipo y documento coincidentes. No se consulta otro proveedor RUC para este cruce.

Si la pantalla no tiene esa selección, `useInvoiceReceiverIdentity` usa el método existente `masterDataApi.getPartners({q:documento})` (GET `/master-data/partners`), con autenticación y empresa del cliente HTTP actual. Es una lectura del endpoint ya disponible: no se modifica el maestro, su API ni otro módulo. Se omite el filtro por rol y estado para incluir también terceros registrados inactivos o con otro rol, y se filtra localmente por tipo y documento exactos.

La lectura se prepara al completar un documento con longitud válida para el contexto. La lectura se considera reciente durante 30 segundos (`staleTime`), con clave por empresa, usuario, tipo y número; la respuesta de otro documento no se usa para la identidad actual. En Factura se consulta solo un RUC de 11 dígitos; en Boleta y Notas también puede tratarse de DNI.

Una consulta pendiente o fallida no se interpreta como inexistencia. Sin datos verificados se detiene temporalmente la revisión, se muestra el estado/error y se permite reintentar con la acción de emisión. Una respuesta válida sin coincidencias permite continuar. Este criterio evita que un fallo de conexión deje pasar una identidad que no se pudo comprobar.

## Verificaciones

- Pruebas dirigidas del cruce y flujos compartidos: **4 archivos / 60 pruebas**, verde.
- Pruebas dirigidas de Bolsas y atajos adaptadas a la lectura asíncrona: **2 archivos / 9 pruebas**, verde. Se conservan las aserciones de payload, bolsas y envío único. También se ajusta la espera de la prueba de recuperación del borrador.
- Suite completa final: **234 archivos / 1730 pruebas**, verde (`npm test`).
- Build: `npm run build`, OK (TypeScript y Vite).
- Lint: sin hallazgos nuevos en los ocho archivos del cambio; permanecen los cuatro errores preexistentes de `InvoiceEmissionForm`, contrastados contra el contenido de la base con la misma configuración de lint.
- Se comprueban coincidencia exacta y tolerante, discrepancia real, no registrado, DNI/RUC en boleta, notas de crédito/débito, selección confirmada sin lectura adicional, terceros de otro rol/inactivos, error/reintento del maestro y bloqueo al confirmar si se actualiza el nombre registrado durante la revisión.
- Solo dobles para servicios y emisión. No hay emisiones reales, escrituras al maestro, cambios de backend, migraciones ni alteraciones de `invoiceEmitPayload`, `masterDataApi`, `CustomerLookupField` o `invoiceCustomerIdentity`.

## Aplicación y manifiesto

Copiar los ocho archivos bajo `frontend/` a sus rutas relativas a la raíz del front sobre la base indicada. No hay archivos que eliminar en el front. `FERRY.md` y `SHA256SUMS` son exclusivamente transporte y no forman parte del código de producción. Verificar desde la raíz de esta rama con `sha256sum -c SHA256SUMS`.

## Archivos (+/− respecto de la base front)

| Ruta del front | Diff |
| --- | ---: |
| `src/modules/invoices/components/InvoiceEmissionForm.tsx` | +5 / −1 |
| `src/modules/invoices/hooks/useInvoiceReceiverIdentity.ts` | +37 / −0 |
| `src/modules/invoices/lib/invoiceReceiverIdentity.ts` | +15 / −0 |
| `test/unit/modules/invoices/invoiceBagsRegistered.test.tsx` | +2 / −1 |
| `test/unit/modules/invoices/invoicePageKeyboard.test.tsx` | +3 / −2 |
| `test/unit/modules/invoices/invoiceReceiverIdentity.test.ts` | +21 / −0 |
| `test/unit/modules/invoices/invoiceReceiverIdentityForm.test.tsx` | +93 / −0 |
| `test/unit/modules/invoices/invoiceVentanilla.test.tsx` | +1 / −1 |

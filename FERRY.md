# Ferry — Semana Cueva, paquete 4

Back: `feat/cueva-cierre`, base `646fa51a9e1862efc9265c529d0d33b81f44d978`.
Front: CarlosSoles/Fronted-sistema-mype-sunat, base `4fb2d30f841a374ce53efc57d790832b52c68510`.

Aplicar después de la entrega de roles administrables. No se modifican sus
fuentes ni pruebas. No hay PR ni merge de esta entrega.

## Aplicación e inventario

Ejecutar `sha256sum -c SHA256SUMS` en la raíz del back. **Copiar exclusivamente
los archivos frontend/ enumerados en SHA256SUMS**, quitando ese prefijo, sobre
el front. El espejo del back contiene también archivos heredados de ferries
anteriores que no pertenecen al delta de este paquete: no copiarlos ni borrarlos
en el front. FERRY.md y SHA256SUMS son manifiestos de este paquete y su
composición en el back debe respetar la secuencia de entregas.

API nueva consumida: GET/PUT `/invoices/commercial-defaults` por la
configuración comercial, los formularios de emisión M1 y el POS; POST
`/invoices/connection-test` por el diagnóstico SUNAT; GET
`/configuration/links` por la agrupación ADMIN. PUT y diagnósticos requieren
ADMIN. Los endpoints existentes de configuración y alta de cliente conservan
su contrato. El SQL aditivo se entrega en scripts/manual; no se aplica a bases
compartidas. Consultar docs/m1/cueva-cierre.md para validación, detenciones y
conteos finales.

Archivos del delta:

- `src/components/layout/ConfigurationMenuLink.tsx`
- `src/components/layout/Navbar.tsx`
- `src/modules/invoices/InvoiceList.tsx`
- `src/modules/invoices/components/ConfigurationHub.tsx`
- `src/modules/invoices/components/CustomerLookupField.tsx`
- `src/modules/invoices/components/InvoiceCommercialDefaults.tsx`
- `src/modules/invoices/components/InvoiceEmitCampos.tsx`
- `src/modules/invoices/components/InvoiceEmitModal.tsx`
- `src/modules/invoices/components/InvoiceIssuerConfigForm.tsx`
- `src/modules/invoices/components/InvoiceSettingsTab.tsx`
- `src/modules/invoices/components/SunatConnectionTest.tsx`
- `src/modules/invoices/hooks/useCommercialDefaults.ts`
- `src/modules/invoices/lib/invoiceDebitAmount.ts`
- `src/modules/invoices/lib/invoiceEmitValidation.ts`
- `src/modules/invoices/pages/InvoiceEmissionPage.tsx`
- `src/modules/invoices/pages/InvoiceSettingsPage.tsx`
- `src/modules/sales/pages/SalesPosPage.tsx`
- `test/unit/modules/invoices/cueva-commercial-defaults.test.ts`
- `test/unit/modules/invoices/cueva-configuration.test.tsx`
- `test/unit/modules/invoices/cueva-connection.test.tsx`
- `test/unit/modules/invoices/cueva-debit-amount.test.ts`
- `test/unit/modules/invoices/cueva-pos-payment.test.tsx`
- `test/unit/modules/invoices/cueva-single-identity.test.tsx`
- `test/unit/modules/invoices/invoiceM1Regressions.test.ts`

## Validación final

Front: base 199 archivos/1488 pruebas; entrega 205 archivos/1504 pruebas,
todas aprobadas, sin omisiones. Vitest inventaría 367/373 agrupaciones de
suites, respectivamente; no se confunden con archivos. Back: base 435 archivos,
4228 pruebas aprobadas, 1 fallo y 50 omitidas; entrega 443 archivos, 4263
aprobadas, 0 fallos y las mismas 50 omitidas (8 suites). Builds aprobados.
La fase 0 pusheada es 3ca39c61; el detalle por parte consta en el informe.

El delta consta de 24 archivos (17 fuentes y 7 pruebas). No copiar todo el
espejo heredado. Ejemplo de aplicación desde la raíz del back, con FRONT_TARGET
apuntando al checkout del front que se haya preparado para la revisión:

```sh
: "${FRONT_TARGET:?Defina FRONT_TARGET con el checkout del front}"
sha256sum -c SHA256SUMS || exit 1
while read -r checksum path; do
  case "$path" in
    frontend/*) install -D "$path" "$FRONT_TARGET/${path#frontend/}" ;;
  esac
done < SHA256SUMS
```

El catálogo de roles/menús y los archivos protegidos de la entrega anterior
permanecen intactos. La ubicación global de Configuración usa Navbar y la ruta
administrativa existente; no introduce otra pantalla ni modifica Sidebar/rutas.
Antes de desplegar los defaults comerciales, revisar y aplicar su SQL por el
procedimiento manual autorizado. En este encargo solo se ensayó localmente.

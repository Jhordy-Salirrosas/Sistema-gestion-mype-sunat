# FERRY — Parte 6b, pulido de presentación M1

## Destino y bases

- Repo destino: `CarlosSoles/Fronted-sistema-mype-sunat`, rama `dev`.
- Base front: `95cf0586080422ef532be18449f8d43033734007`.
- Cabeza del clon front verificado: `43fa33899d1d93f0ed8133091076e6c7ed1f0346`.
- Base del contenedor back: `fecbe44ab6b5d6d969dd3a7ff1acf0a9123959a2`.
- Back requerido: `fix/m1-pulido-6b`, `26905f39250f1288d6bbf17be09e618fc1d71d14`.
- Ferry en el remoto back: `ferry/m1-pulido-6b`.

Copiar SOLO las 23 rutas del manifiesto, en sus rutas exactas. No fusionar esta
rama contenedora como código back ni copiar package.json/schema del contenedor.
No hay eliminaciones de rutas respecto de la base front. El remoto front no fue
modificado por Codex. Integración, PR y despliegue quedan a cargo de Emma.

## Cinco commits separados

| Punto | Commit front de origen | Commit ferry |
|---|---|---|
| 6b-1, importes persistidos | `276acb4` | `63938e4` |
| 6b-2, pago directo visual | `61b72bf` | `fa0c3ae` |
| 6b-3, refresco de red | `c145168` | `7c42cfb` |
| 6b-4, siguiente de configuración | `78db515` | `585bc52` |
| 6b-5, origen del resultado | `43fa338` | HEAD de esta rama; incluye este manifiesto |

## Cambios y límites

1. Detracción/retención vienen de importes persistidos expuestos por el back;
   se transportan hasta la celda, sin recalcular tasas o umbrales. El contrato
   mantiene null para un importe no registrado; la grilla no inventa importes.
2. Pago directo mostrado usa depósito BN redondeado: S730.17 − S73.00 = S657.17.
   Si hay retención, también se descuenta del pago directo. La suma depósito,
   retención y pago directo conserva el total. Neto fiscal/cuotas/XML conservan
   detracción exacta (S657.15 en el ejemplo), con explicación visible al crédito.
   El cálculo mostrado no constituye una constancia bancaria.
3. Actualizar pide red sin fallback silencioso, publica nueva lista y contadores,
   invalida métricas M1 y muestra progreso/resultado. Error conserva los datos
   previos con advertencia. Lecturas normales conservan el fallback offline;
   src/lib/offlineCache.ts y el resto de módulos no cambian.
4. Ambos formularios muestran current_correlative + 1 de configuración. Sin dato:
   «no disponible». Se elimina la estimación del modal desde el listado/base 100.
   Es informativo y no reserva ni consume números.
5. El bloque de respuesta y el contador usan las tres clases existentes de 5B:
   validación local, SUNAT y origen no confirmado. Totales de rechazados/estados
   internos, agregado remoto de etiqueta neutral y CDR auténticos intactos.

## Verificación

| Suite completa | Base | Final |
|---|---:|---:|
| Front, archivos | 112 | 118 |
| Front, pruebas | 849 | 866 |
| Back, suites aprobadas | 276 | 277 |
| Back, pruebas aprobadas | 2544 | 2552 |
| Back, omitidas | 4 suites/38 pruebas | 4 suites/38 pruebas |
| Snapshots fiscales back | 12 | 12, sin cambios |

Cero fallos finales. Builds front/back OK; lint back limpio. ESLint del front
conserva los 2 errores y 5 avisos anteriores de las fuentes base, contrastados
por stdin; no se modificaron umbrales ni configuración ni se silenciaron reglas.
Pruebas nuevas de red y transporte usan clientes simulados. No se ejecutaron
emisiones ni llamadas reales SUNAT. No hay migraciones nuevas, cambios de
esquema, PR, merge o despliegue. Documentación detallada: docs/m1/auditoria-solucion.md,
sección «Parte 6b», en la rama back requerida.

## Manifiesto completo — 23 rutas

Los bytes del ferry se contrastaron contra el clon front verificado antes del
commit final. SHA-256 por archivo:

| Ruta exacta | SHA-256 |
|---|---|
| `src/modules/invoices/InvoiceList.tsx` | `3d57876725c27c236eda2f1a25c14eb1b7b3b73f0de73b9b5dcf5a800a66d1d1` |
| `src/modules/invoices/components/InvoiceCdrModal.tsx` | `254acbab8fdffd66a632770b703c8cbd524f3282148d936a862974c1423f7362` |
| `src/modules/invoices/components/InvoiceEmitCampos.tsx` | `5614ec6a3f7c6c27f01ec5ac7841f8b77a5812debca04b9ca0c5a727e66ee6d1` |
| `src/modules/invoices/components/InvoiceEmitModal.tsx` | `044628cde9283ef63093842e558de31fd9d890875d10f03b6f465ff3078907de` |
| `src/modules/invoices/components/InvoiceEmitResumen.tsx` | `5749b6d2959b2ec58d18f534a916f750c0e6f0318e4feccc7b3fd3b0af386da8` |
| `src/modules/invoices/components/InvoiceFiltersBar.tsx` | `8c8283d083f41ad0096fc9d851e54d82060d34f3163076f17a8a6565d2525a59` |
| `src/modules/invoices/components/InvoiceKpiCards.tsx` | `9f9b215fdd041b5b125f45a1ec9b81c33b0ea8bedbbb989b1734c167530b63ab` |
| `src/modules/invoices/components/InvoiceNextNumber.tsx` | `e0ca35d03bf85904b742090e4eaad305942cec5937139a4ac7c97e392d72abd7` |
| `src/modules/invoices/hooks/useInvoiceRefresh.ts` | `951ca458a2753e66a2d4dd2f2110ae6f202c60f092e2dbce19fd97c33f1bccb8` |
| `src/modules/invoices/lib/invoiceApiMapper.ts` | `56116f82ec19d6ee4e9805d403e8dfdeaf80235eb5bc5ccd6950f88c2e9ece09` |
| `src/modules/invoices/lib/invoiceMapper.ts` | `739c295c245dc4170042b1ce70b2500e90498562c7d6713e8b5923fcd33bfb3d` |
| `src/modules/invoices/lib/invoiceMetrics.ts` | `87b818dd5f6e0ee28c185ed11b00da07437ab4cb5420f2b3fc9d70393ada35b2` |
| `src/modules/invoices/lib/invoicePagoPresentacion.ts` | `17470068ee1c2e537dd505c27ef8100ca7c716c70f20318cf72b606c9b6b63d3` |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | `bfb5e8b2b6749cd0b927c959d7b8b353f351d8e94715410a8230cf6722bd615a` |
| `src/modules/invoices/services/invoicesApi.ts` | `1b585799d33e8287eadbe336cbe5970af6f4a68a797e4029ab304bcddad5c0f4` |
| `src/modules/invoices/types/invoice.types.ts` | `f45d54e4abb891397b465797d44f4b9f33b34b490dcae617791edc0a7ee3a6ba` |
| `test/unit/modules/invoices/invoiceBandejaResiduos.test.tsx` | `5f9b9201724dda89551fd7ec7a8ae978220db24647672c6278bffe430e692c55` |
| `test/unit/modules/invoices/invoicePulido6bImportes.test.tsx` | `dea3fb8201a3638fabedc44f5da00562bc53674d422612540a147c57cc56255e` |
| `test/unit/modules/invoices/invoicePulido6bNumero.test.tsx` | `e268c8d507c470cc12bbaf3703aaa1050498b762f6860a600cc6801db532411b` |
| `test/unit/modules/invoices/invoicePulido6bOrigen.test.tsx` | `cd39ae211ee11474ec25e05d456a60494d626998d87864dc1487bc94a9360f89` |
| `test/unit/modules/invoices/invoicePulido6bPago.test.tsx` | `744cb6936ebdc4162c5d2f96a8dd7992d308641e49198536bcb67a59b2fd3761` |
| `test/unit/modules/invoices/invoicePulido6bRed.test.ts` | `eb88c33ca8491189c4d7345b7f67d0b947620251cace4d7f42004fd627e2745f` |
| `test/unit/modules/invoices/invoicePulido6bRefresh.test.tsx` | `1aa98aeb26194395a5cc513609c477d2cf0d73964840a7daf8b96c3f1bbcc0ff` |

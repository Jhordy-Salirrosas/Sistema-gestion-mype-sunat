# M1 — retención cero sin operación gravada

## Base y entrega

Rama única de entrega: `fix/m1-retencion-sin-gravada`, creada desde `fix/m1-paquete-auditoria` en `38a6402371b7969cce005315eabad72ca1c34079`, no desde main. Incluye el backend en sus rutas y los archivos del front bajo `frontend/`. No se crea PR ni rama de entrega en el repo front.

La base frontend es main `04c137fcba62b24e907876e5f646158c92f57461` de CarlosSoles/Fronted-sistema-mype-sunat más los 22 archivos que transportó el paquete. Esa composición se reconstruyó y probó antes del cambio. Se conservan los archivos heredados del ferry del paquete; este encargo modifica o añade únicamente las rutas enumeradas abajo.

## Regla y límite

Una base gravada exactamente cero excluye la retención del IGV, aunque el cliente sea agente y el total supere S/700. Se aplica a exoneradas, inafectas, su combinación y gratuitas. Se comprueba la base gravada del documento; no se deduce la regla solo del IGV informado.

No se reabre el caso mixto. El cálculo heredado permanece sobre el total cuando hay base gravada distinta de cero: gravada 1000 + IGV 180 + exonerada 500 mantiene retención 50.40 y neto 1629.60; gravada pura 1000 + IGV 180 mantiene retención 35.40 y neto 1144.60. La exclusión por SPOT del paquete permanece. No cambian tasa, umbral ni moneda. El tratamiento normativo de mixtos sigue pendiente según la auditoría del paquete.

El front aporta la base gravada al helper desde liquidación, flujo, resumen y página real. La fábrica de demostración también aporta su afectación; sus restantes cálculos permanecen iguales. El parámetro adicional es opcional para no romper usos escalares anteriores sin contexto documental. Backend usa bases.gravado en el adaptador, el agregado/desglose en totales UBL y gravadoR en ambos caminos del puente contable M1. No hay capas detenidas.

## Archivos de este encargo

Backend, rutas relativas al repo:

- `src/modules/invoices/application/services/emitirComprobanteAdapter.ts`
- `src/modules/invoices/ublTotalesHelper.ts`
- `src/modules/invoices/application/services/invoiceBridgeCoordinatorService.ts`
- `test/unit/invoices/retencionSinGravada.spec.ts`
- `docs/m1/auditoria-solucion.md` (adiciones al final; auditoría anterior íntegra).

Front, rutas relativas al destino, transportadas con prefijo `frontend/`:

- `src/modules/invoices/lib/invoiceRetentions.ts`
- `src/modules/invoices/lib/invoiceFlujoPago.ts`
- `src/modules/invoices/components/InvoiceEmitResumen.tsx`
- `src/modules/invoices/pages/InvoiceEmissionPage.tsx`
- `src/modules/invoices/data/invoiceDemoTypes.ts`
- `test/unit/modules/invoices/retencionSinGravada.test.tsx`

También se actualizan este FERRY.md y SHA256SUMS. El manifiesto cubre todos los archivos frontend presentes, incluidos los heredados sin cambio, y este documento; no se incluye a sí mismo.

## Aplicación

1. Revisar el diff de esta rama contra `38a6402371b7969cce005315eabad72ca1c34079`. Este arreglo depende del paquete.
2. Ejecutar `sha256sum -c SHA256SUMS` desde la raíz de la rama.
3. Si el paquete ya está aplicado en el frontend, copiar únicamente las seis rutas de este encargo. Si se parte del main frontend base indicado, aplicar los 24 archivos bajo frontend/ (paquete más este cambio), retirando solo el prefijo frontend/. Son archivos completos: ante cambios posteriores, comparar e integrar antes de reemplazar.
4. Ejecutar las suites completas y luego los builds. Back: `NODE_OPTIONS=--max-old-space-size=6144 npm test -- --runInBand`; front: `npm test`; después `npm run build` en cada repo. No ejecutar el build junto con Jest. No configurar credenciales reales ni habilitar pruebas SUNAT beta.
5. Incorporar backend y front mediante el tren de revisión habitual, manteniendo ambos lados alineados. Esta entrega no ejecuta integración, PR ni despliegue.

## Verificación

| Verificación | Base del paquete | Final |
|---|---:|---:|
| Backend: suites aprobadas | 346 | 347 (+1) |
| Backend: pruebas aprobadas | 3477 | 3488 (+11) |
| Backend: optativas omitidas | 17 suites / 93 pruebas | 17 suites / 93 pruebas |
| Backend: snapshots | 12 | 12 |
| Front: archivos aprobados | 176 | 177 (+1) |
| Front: pruebas aprobadas | 1345 | 1357 (+12) |

Cero fallos en las suites completas finales. Builds de ambos repositorios correctos, ejecutados secuencialmente después de terminar Jest. Lint backend sin errores, con las tres advertencias heredadas. ESLint de los cinco archivos productivos frontend de este encargo conserva únicamente el error preexistente react-hooks/set-state-in-effect en InvoiceEmissionPage; no se declara el lint global frontend verde.

Los 24 archivos frontend transportados (incluidos los heredados sin cambio) se cotejaron byte a byte con el checkout final probado. SHA256SUMS contiene 25 entradas: esos archivos y este FERRY.md.

Pruebas nuevas con dobles/fixtures: exonerada sola, inafecta sola, exo+inafecta, gratuita, gratuita con ICBPER superior al umbral, agregado sin detalle, dos caminos del puente, liquidación, flujo, resumen, helper, fábrica y página real. Los ejemplos mixto y gravado puro fijan exactamente los importes anteriores. Permanecen las regresiones del paquete que comparan respuesta serializada y XML de regímenes únicos.

## Reversión y límites

Revertir únicamente los commits posteriores a 38a64023 y la aplicación de las seis rutas frontend de este encargo. Los cambios anteriores del paquete permanecen independientes.

Sin dependencias nuevas, migraciones, acceso a base compartida, emisiones reales, llamadas a Decolecta, reescritura de documentos persistidos ni cambios en configuración del emisor. El tratamiento de mixtos continúa como quedó documentado en el paquete; el caso puro sin gravada queda corregido.

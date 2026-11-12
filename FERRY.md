# Ferry — Parte 8F, F7

Base front: `dc626d34234334a4a1026d0c6460d5382a62a162`.
Rama: `ferry/m1-8f-higiene-robustez`.
Destino de publicación: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, igual que los ferries anteriores. El origen del front se conserva para lectura; no se modifica su main.
Back asociado: `fix/m1-8f-higiene-robustez` (F7).

## Alcance

La presentación del siguiente número y el adaptador de configuración no anuncian un correlativo de nueve dígitos. La serie agotada muestra una condición explícita cuando se conoce el último número; los datos ausentes conservan el fallback de numeración no disponible. La asignación efectiva sigue siendo del servidor. Sin emisiones ni cambios de datos.

## Archivos y SHA-256

| Archivo | SHA-256 |
|---|---|
| `src/modules/invoices/components/InvoiceNextNumber.tsx` | `1bc119c7d6423baa0ea9c22465d9bf389dec33270c27df8df6497267c7813928` |
| `src/modules/invoices/hooks/useInvoiceConfig.ts` | `d8a8e2d80708fb1020c8bae560f8549be7ffc0228b3669ae151538de96b50b4c` |
| `test/unit/modules/invoices/invoice8fSeriesLimit.test.tsx` | `1e12ea314fd68abb5c137d4abf2106b69392cb856c4306f3befe3c71ba32bcef` |

## Validación

Focal F7: 1 archivo / 3 pruebas aprobadas. Suite completa front: 135 archivos / 970 pruebas aprobadas. Typecheck `tsc -b` y build Vite aprobados. No se modifican aserciones de pruebas anteriores. Los conteos completos del back figuran en el informe de cierre de la Parte 8F.

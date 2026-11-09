# Ferry del front: Idempotency-Key

Repositorio destino: CarlosSoles/Fronted-sistema-mype-sunat.
Rama local del front: `feat/m1-idempotency-key`.
SHA base de dev: `a4b9bb6d05b9131cedc3d2d94e50440d51dd320a`.

Esta rama ferry tiene una raíz independiente y contiene solamente los archivos
nuevos/modificados del front más este manifiesto. Emma debe copiar los archivos
listados a sus rutas exactas en el front, conservando el resto de ese repositorio.
No fusionar esta rama con el backend. No se creó PR ni se hizo merge.

## Commits locales del front (en orden)

- `710c332e66198792deb8ccfa653bc2795282dd50 feat(invoices): preserve idempotency keys across emission retries`
- `228d93a96de4897f01353285aa1d447797046579 fix(resilience): persist invoice idempotency keys in offline queue`

## Archivos del front

| Estado respecto de dev | Ruta exacta relativa del front |
| --- | --- |
| modificado | `src/lib/outbox.ts` |
| modificado | `src/modules/invoices/components/InvoiceEmitModal.tsx` |
| nuevo | `src/modules/invoices/lib/invoiceIdempotency.ts` |
| modificado | `src/modules/invoices/pages/InvoiceEmissionPage.tsx` |
| modificado | `src/modules/invoices/services/invoicesApi.ts` |
| modificado | `src/modules/resilience/hooks/useOfflineQueue.ts` |
| modificado | `src/modules/resilience/services/invoiceIngestApi.ts` |
| modificado | `src/modules/resilience/services/offlineQueue.ts` |
| modificado | `src/modules/resilience/services/offlineQueueSyncer.ts` |
| nuevo | `test/unit/modules/invoices/invoiceIdempotency.test.ts` |
| nuevo | `test/unit/modules/invoices/invoiceIdempotencyForm.test.tsx` |
| nuevo | `test/unit/modules/invoices/invoiceOfflineIdempotency.test.ts` |
| modificado | `test/unit/modules/invoices/invoiceTa63Selector.test.tsx` |

Total: 13 archivos del front (4 nuevos, 9 modificados), más FERRY.md.
Diff del front: 258 inserciones, 23 eliminaciones.

## Comportamiento

- Los tres POST de creación envían Idempotency-Key en headers, separado del cuerpo.
  Los servicios exigen una clave explícita para evitar generar otra al reintentar.
- El modal (incluidas notas 07/08) y la página conservan una clave por cuerpo
  pendiente; un cambio de cuerpo, un formulario nuevo o un alta exitosa renuevan
  la clave. Un 409 muestra un mensaje claro sin limpiar el formulario.
- La Outbox de localStorage conserva la clave del intento online y la reutiliza
  al sincronizar. Las operaciones antiguas sin ese campo utilizan su ID persistido.
- IndexedDB utiliza el UUID generado al encolar como clave persistida del ítem.
  El envío online transfiere esa misma clave si termina en la cola. Se conserva
  en reintentos automáticos, manuales y recargas; no cambia el algoritmo de cola.
- El 409 de ingesta se clasifica como rechazo y conserva el ítem/payload; no se
  anuncia como alta exitosa. El formulario de emisión de prueba conserva sus datos.

## Validación

- Suite completa: npm test — 96 archivos y 745 pruebas aprobadas, 0 fallos.
- Se agregaron 21 pruebas en 3 archivos.
- Verificación focalizada final: 5 archivos, 35 pruebas aprobadas.
- Tras precisar el mensaje de conflicto de ingesta: 6 pruebas offline aprobadas.
- Typecheck: npx tsc -b — aprobado, 0 errores.
- Build: npm run build — aprobado (incluye tsc -b y Vite).
- git diff --check — aprobado.
- No se modificaron package.json ni el lockfile ni otras pantallas/módulos.

La suite existente imprime avisos de red de jsdom sin afectar su resultado.

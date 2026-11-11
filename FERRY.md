# FERRY — P3: preparación local durable

Destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base front main: `f7c4191b0c4dbf57364a6a56ed031f82752f4497`.
Base back main: `a4534b91768902392c2c3bba31a873d52817e006`.
Back asociado: `fix/preparacion-local-notas`, `db0b649f904ab4ccbb365fb63ab3f7197ccf5091` (P1, P2 y P3).
Clon front validado: `ed31e1e33526b90b3f94dacf3cf262c0faba2fa5`.
Ferry: `ferry/preparacion-local-notas`, un commit P3. Sin push al repositorio front.

## Aplicación

Copiar SOLO los siete archivos siguientes a sus rutas exactas en el front.
No copiar el resto del árbol back ni FERRY.md al front. No hay borrados,
paquetes ni migraciones. P1 y P2 son exclusivamente back.

| Operación | Ruta exacta front | SHA-256 |
|---|---|---|
| Reemplazar | `src/modules/invoices/components/InvoiceAuditTrail.tsx` | `748faf7ad846cd142cc9d969787cabe05e74a682e890f9628afdb1153f371e32` |
| Reemplazar | `src/modules/invoices/components/InvoiceCdrModal.tsx` | `523b4c799f3ec02ab509e7062df7f47c6f7776b619cd37484d45fa5af30411b8` |
| Reemplazar | `src/modules/invoices/components/InvoiceStatusBadge.tsx` | `dc8ec018b41c18c75e55544b75a68a39cd032ab41d7457165b477566250ccd93` |
| Reemplazar | `src/modules/invoices/lib/invoiceResultPresentation.ts` | `0f674141b6465c7c3b9311f80afa04bcedf1ad27bfe3d6114a7989b6d263ddd3` |
| Reemplazar | `src/modules/invoices/pages/InvoiceMonitorPage.tsx` | `e39e62bb6dc0a4e3e424c12c6ae76088fa2749d825aca24a83451992f4cfbe8a` |
| Reemplazar | `test/unit/modules/invoices/invoiceMonitorRetry.test.tsx` | `6600ba0fbc8533186eaf96a3f3b34d722435063d29022f768153c9859da647b8` |
| Reemplazar | `test/unit/modules/invoices/invoicePulidoPresentacion.test.tsx` | `568998ba6e7165dcd059a8c47099fa3df6c8704323e0ef18d7701446dd88956c` |

## Comportamiento

El contrato añade `origen: PREPARACION_LOCAL`, `categoria`, `etapa` y `recuperable` opcionales.
Lista, detalle, bitácora y Monitor muestran «Bloqueado en preparación local».
La bitácora distingue datos inválidos de certificado/configuración/infraestructura
recuperables; el Monitor conserva Reintentar y añade filtro de preparación.
ERROR_RED permanece como estado fiscal. TRANSPORTE_INCIERTO sigue teniendo prioridad.
No cambia la guarda de saldo: ERROR_RED consume saldo; no hay descarte terminal.

## Acción de producto: reanudación de FC01-00000016

Tras el despliegue del back, FC01-00000016 se reanuda desde el Monitor:
con rol ADMIN de la empresa, buscar el documento y pulsar **Reintentar**.
Equivalente: `POST /api/v1/invoices/{UUID-de-FC01-00000016}/retry-cdr` con autenticación
normal de la empresa. Se rescata el trabajo de DLQ si corresponde; un job activo no se duplica.
En preparación se completa «Devolución total» y se registra M1_NOTE_DESCRIPTION_COMPLETED.
No editar payload ni crear otra nota. El marcador transport_uncertain se conserva:
si hay incertidumbre, la conciliación existente se ejecuta antes de cualquier reenvío.
La acción reanuda el trabajo; no promete aceptación de SUNAT.

## Verificación

Base front: 128 suites / 925 pruebas. Focal P3: 2 suites / 19 pruebas aprobadas.
Build front aprobado; ESLint del alcance: cero errores y un aviso heredado
react-refresh/only-export-components en InvoiceMonitorPage.tsx.
Front completo final: **128 suites / 928 pruebas aprobadas**.
Back validado final: **295 suites / 2714 pruebas; 12 snapshots**, incluidos
reruns aprobados de compuerta no concluyente y outbox aislado; detalles en la auditoría back.
Sin emisiones reales, PRs, merges ni despliegues.

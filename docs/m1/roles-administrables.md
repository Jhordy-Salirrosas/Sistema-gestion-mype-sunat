# Roles administrables — paquete 3B

## Fase 0

Bases confirmadas por fetch el 16/11/2026 (America/Lima): back dev `d28ffc80591e3418b230b0163468d26aab22f298`; front main `dcf7864b3bc5e705ffea08ae3884e9bc0523c328`. Rama back `feat/roles-administrables`; ferry sobre esa base front. Especificación: informe `63f67d6c`, secciones 3 y 4, partes 1–4 exclusivamente. Sin PRs, merges, corte ni habilitación de roles propios.

| Suite antes de construir | Archivos aprobados | Archivos omitidos | Pruebas aprobadas | Pruebas omitidas | Fallos |
| --- | ---: | ---: | ---: | ---: | ---: |
| Back | 412 | 20 | 4166 | 105 | 0 |
| Front | 199 | 0 | 1488 | 0 | 0 |

Back: `NODE_OPTIONS=--max-old-space-size=4096 ROLES_TEST_DATABASE_URL=<PostgreSQL local efímero> npm test -- --runInBand`; 12 snapshots aprobados. El primer intento agotó el heap por defecto antes del resumen; la repetición completa con 4 GiB pasó. Se habilitan las integraciones del paquete 1 únicamente contra PostgreSQL Docker local, puerto 55433 ligado a 127.0.0.1, base roles_adm. No se usa ninguna base compartida. Front: `npm test -- --maxWorkers=2`.

Los dos fixtures `invoiceBagsRegistered.test.tsx` e `invoiceFormValidation.test.tsx` ya usan `hoyLima` calculado con Intl/America/Lima en esta base; no se conserva el problema de fecha fija de la entrega anterior. La línea base se midió antes de cambiar código.

## Límites de esta entrega

La expansión conserva los tres campos enum en el esquema activo: el código actual debe operar antes del corte. Se entregará un esquema candidato de texto/FK separado, validado, listo para la parte 5, sin aplicarlo ni generar un cliente activo incompatible con las columnas enum. Alta/asignación propia requiere flag y almacenamiento de texto; ambas permanecen deshabilitadas antes del corte. La parte 5 y la parte 6 requieren otro encargo.

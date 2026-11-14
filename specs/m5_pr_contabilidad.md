# PR de Contabilidad — descripción y checklist

Copia el contenido de "Resumen" en el PR del backend (`feat/contabilidad-auditoria` → `dev`) y el de
"Cuerpo del PR de frontend" en el del frontend (`feat/contabilidad-hardening` → `main`).

---

## Resumen

Endurece el módulo de Contabilidad sin tocar la lógica de Facturación, Kardex, POS ni Compras más de
lo necesario para exponer datos contables.

**Auditoría (tarea 1 y 5).** Nuevo `GET /api/v1/accounting/audit`: reglas con cuenta inexistente,
inactiva o de mayor; procesos incompletos; asientos descuadrados, sin líneas, duplicados o con
cuentas inválidas; comprobantes aceptados sin asiento o sin costo; **compras sin asiento**; **cobros
vivos sobre comprobantes anulados**; y **mapeos contables inválidos**.

**Distribución (tarea 2).** Tablas `expense_distributions` y `collection_distributions`, regla de
reparto por importes o porcentajes con suma exacta, asiento con una línea por cuenta y endpoints
`GET/PUT /:id/distributions`. UI en Gastos y Cobros.

**Subcuentas de caja y banco (tarea 3).** Tabla `company_treasury_accounts` (alias sobre subcuenta
PCGE), subcuentas `1011/1012/1013/1043` en el catálogo, endpoints `treasury-accounts` y uso de la
cuenta elegida en los asientos de cobro y pago. El Libro Mayor de una cuenta de mayor incluye sus
subcuentas.

**Regularización (tarea 5).** `POST /api/v1/invoices/accounting/reprocess` (en seco por defecto) y
`POST /api/v1/purchases/:id/post-accounting`, ambos idempotentes.

**Anulación (tarea 4).** La comunicación de baja ya no incluye comprobantes de un período cerrado o
con libro PLE generado.

**PLE y cierre (tareas 6 y 7).** Saneo y validación de forma de los libros (tubería, columnas, RUC con
dígito verificador, comprobantes repetidos), 5.1 con sus 21 columnas, totales en el 14.1/8.1, cuenta
de cierre configurable y prueba E2E del cierre anual.

## Migraciones

```
prisma/migrations/20261114130000_accounting_treasury_accounts
prisma/migrations/20261114140000_accounting_distributions
```

Aplicar con `prisma migrate deploy` o `node scripts/apply-all-migrations.js` **antes** de desplegar.
La primera inserta las subcuentas 1011, 1012, 1013 y 1043 en `accounting_accounts`.

## Endpoints nuevos

| Método | Ruta |
| --- | --- |
| GET | `/api/v1/accounting/audit?period=YYYY-MM` |
| GET/POST | `/api/v1/accounting/treasury-accounts` |
| PUT | `/api/v1/accounting/treasury-accounts/:id` |
| GET/PUT | `/api/v1/expenses/:id/distributions` |
| POST | `/api/v1/expenses/:id/post` |
| GET/PUT | `/api/v1/collections/:id/distributions` |
| POST | `/api/v1/invoices/accounting/reprocess` |
| POST | `/api/v1/purchases/:id/post-accounting` |

## Cambios de contrato que el revisor debe mirar

1. **`POST /expenses/:id/pay`** ahora valida el cuerpo con DTO (`whitelist` +
   `forbidNonWhitelisted`): un campo desconocido devuelve 400 en lugar de ignorarse. Los campos
   admitidos son `amount`, `paymentMethod`, `bankName` y `treasuryAccountId`.
2. **Cuenta de caja por defecto**: los asientos en efectivo usan `1011` (Caja principal) en lugar de
   `101` (cuenta de mayor). Requiere la migración aplicada antes del despliegue.
3. **Libro 5.1**: pasa de 8 a 21 columnas; cambia la posición de cuenta, debe, haber y glosa.
4. **Libro 6.1**: devuelve 400 con mensaje en lugar de un archivo con forma de 5.1.
5. **Mensajes de validación** de reglas y cuentas: mismo rechazo, texto más accionable.
6. **`POST /purchases` y `POST /purchases/:id/receive`** agregan `contabilidad` a la respuesta
   (`{ asientoGenerado, motivo }`); el resto del contrato no cambia.
7. **`GET /accounting/ledger`** agrega `subcuentas` y el saldo final ahora incluye el saldo de
   apertura (antes lo ignoraba: era un error de cálculo).

## Pruebas

- Backend: `nest build` ✅, `oxlint` 0 errores, 223 pruebas de contabilidad + 24 de compras ✅.
- Frontend: `tsc -b` ✅, `vite build` ✅, 1 326 pruebas ✅.

> En este entorno Windows 37 suites de `invoices` fallan por `spawn EPERM` al lanzar `python3` para el
> validador SFS de SUNAT (bloqueo del sandbox, no del código). El CI instala
> `scripts/m1/requirements.txt`, así que allí corren.

## Verificación previa al despliegue

- `prisma validate` sobre `prisma/schema` ✅ (esquema coherente tras los dos modelos nuevos).
- Las migraciones **no se pudieron ejecutar en local** (no hay PostgreSQL en este entorno). Siguen la
  convención de nombres de Prisma (índices `_key` / `_idx`, FK `_fkey`) y el CI las aplica con
  `prisma migrate deploy` contra PostgreSQL 16.
- Si el entorno usa `node scripts/apply-all-migrations.js` en lugar de `migrate deploy`, no hay que
  tocar nada: ese script recorre las carpetas en orden alfabético y las dos nuevas ya quedan al final.
- `gen_random_uuid()` (usado en la primera migración) es nativo desde PostgreSQL 13.

## Riesgos

- Cambian reglas por defecto (`RECEPCION 611→6111`, `AJUSTE 759→7599`): re-ejecutar la semilla
  actualiza empresas existentes. Es una corrección, pero conviene hacerlo con respaldo.
- El 5.1 cambia de 8 a 21 columnas: cualquier consumidor que parseara la salida anterior deja de
  funcionar (hoy solo lo usa la propia UI).
- La numeración de asientos reintenta; si un proceso llama a `saveEntry` sin clave de idempotencia y
  hay mucha concurrencia, puede agotar los 3 intentos y devolver 400.
- El 6.1 ahora **falla con un mensaje** en vez de emitir filas del 5.1: es intencional hasta tener la
  estructura oficial.

## Pendiente (explícito)

1. Cuenta por defecto para descuentos (`74`) y para faltantes de inventario (`659`): decisión del
   contador.
2. Reverso en cascada de los cobros al anular una venta.
3. Libro 6.1 y contraste del 5.1 con la hoja oficial de la R.S. 286-2009.
4. Cierre anual E2E contra PostgreSQL.

## Cuerpo del PR de frontend

- Editor de distribución en Gastos y Cobros; selector de cuenta de tesorería (pago de gasto y cobro);
  gestión de cuentas de tesorería en Contabilidad → Plan de cuentas.
- Página `/accounting/auditoria`: reglas, mapeos, asientos, comprobantes, compras y cobros con
  problemas, con simulación y ejecución de la regularización y reintento del asiento de compra.
- Libro Mayor indica las subcuentas incluidas; el PLE muestra los totales del libro exportado y el
  mensaje real del backend cuando un libro no está implementado.

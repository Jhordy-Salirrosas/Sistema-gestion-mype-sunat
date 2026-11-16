# Serie por sucursal — diseño, sin implementación

Base de análisis: back 646fa51a, front 4fb2d30. Este documento no crea tablas,
columnas, endpoints ni datos. El correlativo fiscal actual es empresarial por
tipo/serie; no se reinicia ni se renumera un documento existente.

## Modelo propuesto

- `company_branches`: id, company_id, code, name, local_anexo, domicilio fiscal,
  estado. Única empresa+code. local_anexo debe corresponder al establecimiento
  registrado en SUNAT; una sucursal comercial no inventa un código fiscal.
- `branch_cash_registers`: id, company_id, branch_id, code, name, estado.
  Única empresa+sucursal+code. Una caja es un punto operativo, no un almacén.
- Ampliar `invoice_series` con branch_id y cash_register_id opcional. FK
  compuesta con company_id para impedir cruces de empresa. Conservar la
  unicidad fiscal empresa+document_type+series y su contador existente.
- `user_branch_access`: empresa, usuario, sucursal y cajas autorizadas. Coordinar
  con el catálogo de roles/permisos administrables y los accesos a almacenes;
  no deducir acceso a sucursal de un nombre de rol o de un almacén homónimo.
- Congelar branch_id, branch_code/name y local_anexo efectivos en el documento
  al emitir. Los nombres pueden cambiar; el comprobante histórico no cambia.

Ejemplo de asignación, sujeto a validación del contribuyente:

| Tipo/serie | Sucursal | Caja | Numeración |
| --- | --- | --- | --- |
| 01/F001 | Principal (0000) | C01 | Continuar contador actual F001 |
| 01/F002 | Sucursal Norte (anexo registrado) | N01 | Contador independiente F002 |
| 03/B001 | Principal | C01 | Independiente de F001 |
| 03/B002 | Sucursal Norte | N01 | Independiente de F002 |

El prefijo F/B determina el documento, no la sucursal. F001/F002 son ejemplos;
no se infiere branch_id de los dígitos ni se reasignan series silenciosamente.
Definir también FC/BC y FD/BD: la nota mantiene su tipo/origen F o B y se emite
con una serie autorizada de la sucursal; no cambia la sucursal histórica del
origen. Revisar con contabilidad si se exige misma sucursal o administración
central para notas y bajas.

## Impacto

Emisión: elegir sucursal/caja antes de consultar series, limitar opciones a
accesos vigentes y validar la pertenencia en el servidor. La reserva sigue
siendo atómica por empresa+tipo+serie. Guardar el establecimiento fiscal en el
snapshot UBL; cambiar de sucursal invalida series/almacén incompatibles, no
borra el borrador sin informar. POS y emisión en contexto comparten contrato.

Series: ADMIN asigna la serie a una sucursal y opcionalmente caja. No desactivar
una serie con trabajos pendientes sin tratamiento explícito. La configuración
no consume números. Bloquear traslado de una serie usada a otra sucursal;
para un nuevo establecimiento se crea otra serie.

Reportes: filtros por sucursal/caja y consolidado de empresa; PLE/SIRE y SUNAT
siguen con RUC único. Documentos heredados sin sucursal se agrupan como
«Sin asignación histórica» hasta una conciliación explícita. Aislar también
exportaciones, PDFs, caja, cobranzas, auditoría y puente contable; no confundir
centro de costo con sucursal. Almacén puede asociarse a sucursal mediante una
relación explícita, sin equiparar ambos catálogos.

## Plan por fases

1. Inventario de series activas, contadores, establecimiento SUNAT, colas,
   reportes y accesos. Decidir sucursales/cajas reales y política de notas.
2. Expansión aditiva y APIs de catálogo, con flag apagado. SQL manual con
   preflight por empresa, checksum, locks acotados y reversa; ensayo local.
   No insertar sucursales ficticias ni reasignar históricos automáticamente.
3. Asignación revisada por ADMIN, dobles lecturas compatibles para documentos
   sin branch_id y pruebas de aislamiento, reserva concurrente e idempotencia.
4. Front y servidor preparados bajo flag; caches por usuario/empresa/sucursal,
   validación por solicitud, series sin números quemados y snapshots estables.
5. Corte coordinado con responsables: pausar ingesta, conciliar trabajos y
   contadores, aplicar asignaciones manuales aprobadas y reabrir por empresa.
6. Habilitación gradual y conciliación fiscal/contable. Reversa operacional:
   apagar flag y volver a la selección compatible; nunca retroceder contadores
   ni borrar comprobantes emitidos o series que ya se usaron.

Pruebas previas a habilitar: dos cajas concurrentes, empresa ajena, token con
acceso retirado, falta de serie, reintento idempotente, documentos heredados,
notas sobre otra sucursal, cierres/reportes y reversa sin pérdida de numeración.
La construcción y el corte quedan fuera del paquete 4.

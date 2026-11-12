# Deuda pendiente: validación de padrón RUC (ACTIVO / HABIDO)

**Estado:** abierta. Existen validación de formato/Módulo 11, endpoint protegido, caché con TTL y adaptador HTTP configurable. Falta acreditar un proveedor autorizado operativo y cerrar la integración obligatoria ACTIVO/HABIDO en la creación fiscal cuando corresponda. Tener el endpoint no garantiza esa comprobación antes de emitir. Sin proveedor configurado se mantiene el 503 explícito, sin inventar estados tributarios. La configuración efectiva de producción no se ha verificado en esta auditoría de código.

Este padrón de estado RUC no es el padrón de agentes de retención. La deuda de procedencia/vigencia de esos agentes se documenta por separado en la Parte 8F-F11.

## Estado actual

Existe la tabla `padron_ruc_cache`, el endpoint protegido
`GET /api/v1/sunat/ruc/:ruc`, validación Módulo 11, caché con TTL y un
adaptador HTTP configurable. Para operar en un entorno real se debe configurar
un proveedor autorizado en `SUNAT_RUC_SERVICE_URL`; sin esa configuración el
endpoint responde `503` y no inventa estados tributarios.

El documento pide que, antes de emitir una factura, además del Módulo 11 se
compruebe que el RUC del adquirente esté **ACTIVO** y **HABIDO** según el padrón
de SUNAT, para evitar los rechazos 2027 y 2028.

## Qué SÍ está implementado

`src/modules/invoices/domain/rules/taxpayerIdValidator.ts`:

- Módulo 11 oficial con los pesos `[5,4,3,2,7,6,5,4,3,2]`, incluido el caso
  `10 → 0` y `11 → 1`.
- Prefijos admitidos: 10, 15, 17 y 20.
- Factura (01) y notas (07/08): el adquirente debe ser un RUC válido. Un DNI en
  una factura se rechaza antes de tocar la red.
- Boleta (03): sin documento hasta S/ 700.00; por encima es obligatorio. En la
  Región Selva el umbral baja a S/ 350.00.
- Catálogo 06 en boletas: se valida que el tipo exista y que el número tenga la
  forma del tipo (8 dígitos para DNI, Módulo 11 para RUC).

Verificado con RUC públicos reales: `20100066603` y `20553510661` pasan el
Módulo 11; un dígito alterado lo rompe.

## Qué falta para producción

1. **Configurar una fuente de datos del padrón.** SUNAT publica el padrón en
   descargas masivas periódicas y lo expone por servicio web con credenciales
   SOL. El proveedor debe devolver el contrato documentado en
   `src/modules/sunat/README.md`.
2. **Configurar `.env`.** Sin `SUNAT_RUC_SERVICE_URL`, el endpoint responde
   `503`; no devuelve ACTIVO/HABIDO de mentira.

## Lo que NO se hizo, deliberadamente

- No se devolvió ACTIVO/HABIDO por defecto cuando no hay padrón: un `true` por
  defecto haría pasar cualquier RUC y el validador perdería su sentido.
- No se relajó la prueba del criterio para que saliera en verde.

## Opciones para cerrarlo

| Opción | Qué exige | Cuándo conviene |
| --- | --- | --- |
| A. Import masivo de la consolidación de SUNAT | Descargar el archivo del portal de datos abiertos y cargarlo a `padron_ruc_cache` con un comando `npm run padron:import` | Cuando la empresa va a operar con miles de clientes y puede refrescar el padrón cada semana |
| B. Consulta SOAP con credenciales SOL | Credenciales secundarias del contribuyente en `.env` | Cuando hay credenciales reales y se quiere validar en línea, sin almacenar el padrón completo |
| C. Proveedor externo de consulta RUC | Clave del servicio en `.env` | Cuando el padrón de SUNAT no se puede descargar por tamaño o licencia |

Las tres necesitan lo mismo: la migración, un adaptador que devuelva
`estadoContribuyente` y `condicionDomicilio`, y la regla del validador que
convierte "BAJA DEFINITIVA" o "NO HABIDO" en un rechazo 422.

## Nota sobre el ubigeo

El documento insiste en guardar el ubigeo como **cadena de 6 caracteres y no
como número**, porque el cero inicial (`05...`) se perdería y SUNAT responde con
el error 2335. Quien implemente la opción elegida debe respetarlo: en el esquema
Prisma del documento el campo ya está como `@db.VarChar(6)`.

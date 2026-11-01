# Deuda pendiente: validación de padrón RUC (ACTIVO / HABIDO)

**Estado:** abierto. **Origen:** requisito de la tarea TA-34 (Eje 6) del documento
de auditoría del M1. **Última revisión:** 31 oct 2026.

## Qué falta

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

## Qué falta exactamente, y por qué no se hizo

1. **No existe la tabla `padron_ruc_cache`.** El documento propone una migración
   Prisma (`PadronRucCache` con `ruc`, `razon_social`, `estado_contribuyente`,
   `condicion_domicilio`, `ubigeo`, `direccion_fiscal`, `es_agente_retencion`).
   Crear la tabla es mecánico, pero una tabla vacía no valida nada, así que
   añadir la migración sin el paso 2 daría la falsa impresión de que el control
   existe.
2. **No hay fuente de datos del padrón.** SUNAT publica el padrón en descargas
   masivas periódicas y lo expone por servicio web con credenciales SOL. Ninguna
   de las dos está disponible en el taller, y un cliente SOAP contra un endpoint
   que no se puede autenticar no se puede probar ni demostrar en la exposición.
3. **`.env` no declara una URL de consulta.** Sin ella habría que inventar un
   servicio, y una consulta inventada devolvería ACTIVO/HABIDO de mentira:
   peor que no validar, porque el sistema diría que verifica algo que no mira.

## Lo que NO se hizo, deliberadamente

- No se creó una tabla `padron_ruc_cache` vacía para que el criterio "existe la
  migración" apareciera cumplido.
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

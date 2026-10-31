# Resumen de cambios del nuevo diseño SIRE

## Contexto

Este resumen documenta la evolución reciente del módulo backend de SIRE. El cambio organiza el flujo alrededor de los libros de ventas (RVIE) y compras (RCE), desde la importación de propuestas hasta la conciliación, consulta del historial, exportación de resultados y cierre de periodos.

El alcance identificado en el repositorio es de backend (NestJS, Prisma y pruebas); no corresponde a un rediseño visual de una interfaz web.

## ¿Qué cambió?

### 1. Flujo dividido por responsabilidades

El módulo sigue una separación por capas:

- **Controlador:** recibe solicitudes, valida el usuario y expone las operaciones HTTP.
- **Casos de uso:** coordinan importación, conciliación, exportación, historial y cierre.
- **Dominio:** contiene las reglas de conciliación y los puertos para leer o generar archivos.
- **Infraestructura:** implementa el parser/escritor TXT y la persistencia con Prisma.

Esta separación permite mantener las reglas de conciliación desacopladas de los detalles HTTP y de base de datos.

### 2. Importación de propuestas SIRE

Se agregó la recepción de archivos `.txt` asociados a un periodo y libro. El controlador limita el archivo a 5 MB y verifica la extensión y el tipo MIME. El caso de uso verifica que el archivo tenga contenido, que el periodo siga abierto y que existan filas importables.

El resultado informa cuántas filas se importaron y cuántas se rechazaron, con número de línea y motivo:

```json
{
  "imported": 18,
  "rejected": 2,
  "errors": [
    { "line": 4, "reason": "Fecha, monto o CAR inválido." }
  ]
}
```

Ruta: `POST /api/v1/sire/import`  
Contenido: `multipart/form-data` con el campo `file`, además de `period` y `bookType`.

### 3. Conciliación y clasificación de diferencias

La conciliación cruza los registros locales con los de la propuesta SIRE por su llave de comprobante. Los resultados contemplan:

- `COINCIDENCIA_EXACTA`
- `DIFERENCIA_MONTOS`
- `OMISION_LOCAL`
- `OMISION_SUNAT`
- `DUPLICADO_LLAVE`

La comparación de base imponible e IGV usa centavos enteros para aplicar una tolerancia de S/ 0.05. Si una llave aparece duplicada en cualquiera de las fuentes, se informa el conflicto en lugar de escoger un registro arbitrariamente.

```ts
const isExact =
  Math.abs(baseDifferenceCents) <= 5 &&
  Math.abs(igvDifferenceCents) <= 5;

const discrepancyType = isExact
  ? 'COINCIDENCIA_EXACTA'
  : 'DIFERENCIA_MONTOS';
```

Ruta: `POST /api/v1/sire/reconcile`.

### 4. Historial paginado por empresa

Se incorporó la consulta de conciliaciones cerradas con paginación. La respuesta incluye el periodo, el libro, el estado, el porcentaje de cumplimiento y el conteo por escenario.

```json
{
  "page": 1,
  "limit": 20,
  "total": 3,
  "items": [
    {
      "period": "202609",
      "bookType": "RVIE",
      "status": "CERRADO",
      "complianceRate": 96.25,
      "totalsByScenario": {
        "COINCIDENCIA_EXACTA": 77,
        "DIFERENCIA_MONTOS": 2,
        "OMISION_LOCAL": 1,
        "OMISION_SUNAT": 0,
        "DUPLICADO_LLAVE": 0
      }
    }
  ]
}
```

Ruta: `GET /api/v1/sire/history?page=1&limit=20`.

### 5. Exportación y cierre de periodos

Se agregaron operaciones para exportar un resumen TXT de las diferencias y cerrar una conciliación de un periodo/libro. Los casos de uso verifican que la conciliación exista y que el periodo no haya sido cerrado previamente.

- `POST /api/v1/sire/export`: descarga el archivo TXT.
- `POST /api/v1/sire/close`: marca como cerrado el periodo conciliado.

### 6. Persistencia y aislamiento por empresa

Se amplió el modelo de Prisma y las migraciones para guardar información necesaria para el historial y el análisis de diferencias, incluyendo:

- RUC del emisor en las diferencias.
- Diferencias separadas de base imponible e IGV.
- Origen de duplicados: `LOCAL`, `SIRE` o `AMBOS`.
- Escenario `DUPLICADO_LLAVE`.

Los endpoints requieren autenticación y obtienen la empresa desde el usuario autenticado para consultar o modificar únicamente sus datos.

## Ejemplo de recorrido

```text
1. Importar propuesta del periodo 202609 para RVIE.
2. Conciliar los comprobantes locales contra la propuesta importada.
3. Revisar diferencias y duplicados identificados.
4. Exportar el resumen de diferencias si se necesita.
5. Cerrar el periodo y consultarlo luego en el historial.
```

## Consideraciones pendientes

Los adaptadores TXT actualmente habilitan el flujo con un esquema provisional. El parser usa nueve columnas y el escritor genera un archivo marcado como `BORRADOR`; ambos contienen TODOs para sustituirlos por las estructuras oficiales vigentes de SUNAT por libro. Por tanto, la exportación actual es un resumen de auditoría y **no debe presentarse como un archivo oficial listo para enviar a SUNAT**.

También se reforzó la especificación técnica para distinguir reglas internas del sistema de requisitos normativos y para no asumir formatos o plazos oficiales sin validación contra las publicaciones correspondientes.

## Pruebas

Se añadieron o ampliaron pruebas unitarias para las reglas de conciliación, los casos de uso, el controlador y los adaptadores TXT. Estas cubren, entre otros escenarios, duplicados, tolerancias monetarias, importación, exportación e historial.

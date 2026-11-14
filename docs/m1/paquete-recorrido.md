# Paquete del recorrido M1

## Fase 0

Encargo vigente: reemplazo completo de siete puntos. Rama `fix/m1-paquete-recorrido`, desde back main `9f61bc553955d6e2c332bc35780c5865aeb62e6d`. Ferry sobre front main `8393ea1c72b865d2c4442147e2453f479e11c84b`. No incorpora la rama de depósitos de detracción.

1. Confirmado. InvoiceForcedResend usa etiquetas y textarea sin distribución ni límites de ancho. Se reorganiza solo su presentación y la contención de su modal, conservando campos, llamadas y habilitación. Los paneles hermanos no comparten esa estructura de campos.
2. Confirmado. InvoiceCdrModal lee una vez; conserva el estado del objeto inicial aunque haya consultado el detalle nuevo. Se actualiza con el detalle completo y se relee de forma acotada tras acciones de cola. El reintento vigente se dispara desde bandeja/Monitor, no existe un botón de reintento propio en el modal: no se añade otro; se conectan las acciones actuales con el detalle abierto. El back ya expone estado, CDR e historial suficientes.
3. Confirmado. El QR backend usa correlativo de ocho posiciones, fecha ISO, digest Base64 con relleno y diez campos sin separador sobrante. El generador frontend difiere en los cuatro aspectos. Se alinea con la trama del backend, preservando la espera por XML firmado; se ajustan las expectativas antiguas que fijaban el formato distinto.
4. Confirmado. Cabecera y pestañas son fuentes separadas. Listado y General/formulario consumen cabecera. Se añaden proyecciones del contacto y dirección principales, con orden determinista (marca principal, creación e id) y fallback a cabecera cuando no existen registros. Los campos planos y demás contratos se conservan. Las tres superficies frontend usarán el mismo resolvedor. La edición de cabecera debe actualizar el mismo registro principal que se muestra.
5. Confirmado en ficha. Ya existe selector de estado en el formulario de edición, pero la ficha no ofrece acción. Se agrega allí, respetando readOnly y refrescando ficha/lista; no se añade acción duplicada a la tabla.
6. Confirmado en front: el validador ignora el indicador de edición y rechaza la identidad histórica, aunque los campos están deshabilitados y el PUT no los envía. El back ya valida documentos solo en altas y no acepta cambios de identidad en UpdatePartnerDto. Se exime únicamente una identidad exactamente igual a la original; alta o identidad distinta conserva validación completa. Se fija el comportamiento existente del servidor con regresión, sin abrir una ruta para cambiar identidad.
7. Confirmado. Solo hay endpoints/formularios de alta en las tres pestañas. Se agregan PUT y DELETE con pertenencia empresa/tercero/registro, actualización de principales y refresco. Se valida al escribir: celular peruano de nueve dígitos comenzando por 9, con +51/0051 opcional y separadores habituales; email válido; cuenta peruana y CCI numéricos (CCI de 20 dígitos). Se conserva el soporte internacional de bancos extranjeros, IBAN/SWIFT; no se valida ni reescribe en lecturas históricas. Sin nuevas tablas ni migraciones.

No hay puntos detenidos. Pruebas sin transporte fiscal real, PostgreSQL exclusivamente local. No se crean PRs ni se despliega. El ferry sustituye el inventario heredado ya presente en main y solo transporta los archivos de este encargo.

Líneas base completas verdes antes de modificar código: back 401 suites / 4034 pruebas, con 4 suites / 38 pruebas omitidas y 12 snapshots; front 182 archivos / 1404 pruebas. PostgreSQL local con el esquema de main, sin aplicar migraciones nuevas.

## Punto 1

Panel con contención de ancho, texto con corte de palabras largas, motivo en bloque propio, textarea completo, checkbox alineado y acciones separadas con texto adaptable. El modal contiene el desbordamiento horizontal. Se conservan los campos, textos, permisos, confirmación, decisión y petición existentes. Pruebas del flujo de reenvío forzado verdes; no se modifican los paneles hermanos, que no comparten la causa.

# FERRY — Monitor real M1

Repositorio destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base del frontend: dev en 98963cd781e2eab269497763d832898efcdcd8ac.
Commit local validado del frontend: 1df7f9aac5bd34f9c9b4190a78cd8d0fb724c2ab.
Base de transporte en el backend: e4c8464b19657c14d213af328c6433df78512b31.
Rama de transporte: ferry/m1-monitor-real, publicada exclusivamente en Jhordy-Salirrosas/Sistema-gestion-mype-sunat.
Backend complementario: fix/m1-monitor-real en b0fe44f971f6005e03ed2ffedb7fa8704285bf31.

## Alcance

La membresía DLQ se lee de en_dlq, incluyendo documentos con estado final. El Monitor consulta todas las páginas por red y une por ID; tarjeta y filtro cuentan los mismos documentos únicos y aclaran el número de trabajos cuando difiere. Conserva las clasificaciones de preparación local, incertidumbre y puente como presentación independiente de la membresía.

La página real del Monitor monta InvoiceRvieSection, reutilizando InvoiceOutboxMonitor y el botón «Exportar propuesta RVIE - SIRE (CSV)». Su lote fiscal incluye documentos finales y se carga independientemente de la cola. Se retira el montaje inalcanzable de InvoiceList. Se conserva el formato y criterio del CSV existente, sobre los comprobantes registrados consultados, sin añadir un selector de período.

## Aplicación

Copiar los 11 archivos de frontend/ a sus rutas equivalentes sobre la base indicada. No hay archivos eliminados ni cambios de dependencias. Verificar los hashes de los archivos finales y ejecutar npm test y npm run build en el clon del frontend. Este lote no contiene acciones de despliegue, emisiones, migraciones ni cambios del módulo SIRE.

El backend complementario debe estar disponible para consumir en_dlq y el filtro paginado en_dlq=true. Si la cola no puede leerse, las consultas fiscales normales informan en_dlq: null y el filtro operativo devuelve 503; no se presenta como una DLQ vacía.

## Verificación

- Frontend base: 158 archivos / 1235 pruebas; final: 160 archivos / 1242 pruebas, todas aprobadas.
- Backend base: 338 suites / 3298 pruebas; final: 339 suites / 3308 pruebas aprobadas. Se mantienen 4 suites y 38 pruebas omitidas y 12 snapshots aprobados.
- Código nuevo local: frontend 20/20 líneas y 21/21 ramas; backend 18/18 líneas y 22/22 ramas, 100% en ambos frentes.
- Builds correctos; lint sin errores en los archivos del cambio, con advertencias previas.
- Pruebas con DTO real de lista sin historial, miembros DLQ con estado final, tres documentos/cuatro trabajos, 101 documentos en páginas de 100 filas, rescate y retiro de membresía, exportación alcanzable y fallo de propuesta independiente de la cola.
- Documentación: sección «Monitor real» de docs/m1/auditoria-solucion.md en el backend complementario.

## Manifiesto SHA-256

Las rutas son relativas al repositorio frontend; el archivo transportado se encuentra bajo frontend/.

| Archivo final | SHA-256 |
|---|---|
| src/modules/invoices/InvoiceList.tsx | 50ed2a9654126de58e440411f87fcc7e1c03b9e6cadac27b8fa9b1a0598fac9f |
| src/modules/invoices/components/InvoiceRvieSection.tsx | dcdf8eeff650a8daa2555b556161b294096f0f63eb18bb34e15f848c4f38e621 |
| src/modules/invoices/lib/invoiceMapper.ts | 214985ab68366b5b982996d6dc57049aaa22a2c53fdf83d414f85f32be7f3cd5 |
| src/modules/invoices/lib/invoiceMonitorData.ts | 70f43576edc6a2b06d1d6aba698d5dd0191642d28048535992564af9732f997f |
| src/modules/invoices/pages/InvoiceMonitorPage.tsx | 47a55d66ff984061c759f126c8ed0084120748cdbbd8b26a61d133f0077041b4 |
| src/modules/invoices/services/invoicesApi.ts | 4d5cae66fbc6ea381fe24de34381d1dea407b0c0b095960ecff777b4f2aa68dc |
| src/modules/invoices/types/invoice.types.ts | 9dc87964f6eaebeb21d1342097a6aa08cf2297af79e27a2a0763dae50ee72af7 |
| test/unit/modules/invoices/invoiceMonitorReal.test.tsx | 4751567ac0015434de3fd2efa9948e3d0e0d1952fd9cc8f87e3bc74d2c036ef2 |
| test/unit/modules/invoices/invoiceMonitorRetry.test.tsx | bef2c87685302994e0d5da798f51058b6c38206ad3159a705469f5981fa82dd6 |
| test/unit/modules/invoices/invoiceRvieSection.test.tsx | 64e6554fc1347afbe845d0bc44cbf0bdaf78ebbca20e751df466ad2b85b873c0 |
| test/unit/modules/invoices/p9-close.test.tsx | d650279eb5fe411696004ed8bf1c84c481f9b8b9ee3a0576df1c430ba6b02003 |

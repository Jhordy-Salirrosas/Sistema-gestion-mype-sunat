# Ferry M1 — consulta SUNAT desde el detalle

Repositorio destino: CarlosSoles/Fronted-sistema-mype-sunat, rama dev.
Base frontend verificada: `34480624cfabb30e6fb59f952679c9153103a53e`.
Commit local frontend: `737ce29`. No se empujó al repositorio frontend.

Copiar únicamente estos cuatro archivos a sus rutas exactas:

- `src/modules/invoices/components/InvoiceCdrModal.tsx`
- `src/modules/invoices/components/InvoiceSunatConsulta.tsx`
- `src/modules/invoices/services/invoicesApi.ts`
- `test/unit/modules/invoices/invoiceConsultaSunat.test.tsx`

No copiar archivos del backend ni FERRY.md al frontend.

Acción nueva en el detalle: «Consultar SUNAT» llama únicamente a
POST /invoices/:id/consultar-sunat y presenta estado/código/mensaje inline.
Maneja no encontrado, incierto, carga y error sin reenvío ni reencolado.
El mensaje real recuperado requiere el complemento backend `9589991`,
en fix/m1-sfs-timeout, que expone description del CDR como mensaje nullable.
La Parte A del backend (`8271c36`) configura el timeout SFS común.

Validación frontend: 98 archivos/779 pruebas aprobados; build y ESLint
de los cuatro archivos aprobados. Seis pruebas nuevas, API simulada.
No se ejercitó contra SUNAT ni se modificaron migraciones.
Sin PR, fusiones ni despliegues. Emma revisa y aplica mediante su tren.

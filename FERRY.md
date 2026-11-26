# Ferry M1 — Liquidación en flujo en Emisión

## Base y destino

- Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
- Base back main: `9e0c87d165ebedd1eb0f75359149638beb09db38`.
- Rama de transporte: `ferry/m1-emision-liquidacion-en-flujo`.
- Repositorio destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base front main: `60181efabedcf4309c5d2052b12863d1dbcb2af6`.
- Commit fuente local: `1a442eadef081761f640d76c7753ab04ef4928a7`.
- Rama destino sugerida: `fix/m1-emision-liquidacion-en-flujo`.

## Archivos y diff

Archivos completos bajo `frontend/`, con rutas relativas a la raíz del front:

- `src/modules/invoices/pages/InvoiceEmissionPage.tsx`: **+6 −32**.
- `test/unit/modules/invoices/invoiceVentanilla.test.tsx`: **+27 −0**.

Diff total sobre la base front: **+33 −32** en dos archivos. Ambos coinciden byte a byte con el commit fuente.

La sección Facturación y pago deja de ser sticky. Se retiran su altura máxima, el scroll de tarjeta/CardContent y el efecto visual que calculaba `--emision-panel-altura`. Se verificó que `panelPagoRef` y esa variable no tenían otros usos. La tarjeta sobrescribe su overflow-hidden compartido con overflow-visible únicamente en esta página; no se modifica el componente compartido.

Liquidación queda como el último bloque dentro de CardContent, en flujo normal tras los campos de pago y las cuotas condicionales existentes. Se elimina la banda exterior con shrink-0, border-t y bg-muted/30. Se conservan en su orden el desglose, Importe total, nota/campos de detracción y botón Revisar y emitir. No se modifican cálculos, manejadores, atajos, payloads, ids ni accesibilidad: permanecen emision-facturacion y emision-liquidacion con su tabIndex. El contenido desde el título Liquidación hasta el botón y la barra móvil Resumen de pago se comprobaron idénticos a la base. La barra móvil mantiene sticky bottom-0 y lg:hidden.

## Verificaciones

- Pruebas dirigidas: **1 archivo / 12 pruebas verdes**.
- Suite completa: **225 archivos / 1677 pruebas verdes**.
- Build completo: **OK**.
- Lint: **sin hallazgos nuevos respecto de la base**. Tanto main limpio como el cambio reportan los mismos **216 errores y 27 advertencias previos**; los diagnósticos coinciden tras normalizar rutas y espacios. El lint global no se declara verde.
- La nueva prueba cubre ausencia de sticky, altura máxima y overflow de scroll/recorte en los contenedores del panel; Liquidación como último bloque dentro de CardContent; ancla con tabIndex, orden tras Medio de pago y botón dentro del mismo formulario; conservación de la barra móvil.

El cambio es exclusivamente de estructura/presentación en el front y retirada de código visual muerto. No se modifica código backend, no se despliega y no se realizan emisiones reales. No se intenta push al repositorio front ni se crea PR.

## Aplicación

1. En esta rama del back, ejecutar `sha256sum -c SHA256SUMS`. Deben verificar las tres entradas: los dos archivos frontend y FERRY.md.
2. Preparar el destino sobre la base front indicada. Si avanzó, revisar cualquier modificación de estas dos rutas antes de aplicar.
3. Copiar solamente `frontend/src/modules/invoices/pages/InvoiceEmissionPage.tsx` y `frontend/test/unit/modules/invoices/invoiceVentanilla.test.tsx` a sus rutas relativas en la raíz del front. No crear una carpeta frontend adicional en destino.
4. Comprobar el diff y ejecutar las verificaciones del front conforme al tren de revisión.

**FERRY.md y SHA256SUMS son exclusivamente transporte en esta rama del back. No forman parte del cambio a producción ni se copian al front.** El prefijo frontend/ tampoco forma parte de las rutas de destino.

# Ferry — Emisión M1 en dos paneles

## Bases y transporte

- Rama del back: `ferry/m1-emitir-ventanilla`.
- Front destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Main del front confirmado y base exacta del delta: `45ad4ec69179e73270ea90a46275ae58a82ef8a8`.
- Base del repositorio de transporte: `5b37083a1ee7671854a372f4256caa3a4db418d6`.

## Aplicación y delta real

Copiar los seis archivos de `frontend/` a las mismas rutas del repositorio
front. Revisar contra la base indicada si main incorpora cambios posteriores.
No se modifica código del back. Esta rama no se fusiona al back para instalar
la interfaz: contiene el transporte del delta del front.

| Ruta del front | Cambio frente a la base |
| --- | --- |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | Modificado: operación a la izquierda; facturación/pago y liquidación con Emitir al final a la derecha. Ajuste visual de altura, paneles apilados y resumen móvil persistente. |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | Modificado: breakpoint de presentación según ancho del contenedor a 1024px; conserva campos, validaciones y callbacks. |
| `src/modules/invoices/components/InvoicePaymentPanel.tsx` | Nuevo: botones Efectivo/Yape/Tarjeta/Crédito, catálogo completo existente y referencia local de entrega/vuelto. |
| `test/unit/modules/invoices/invoiceVentanilla.test.tsx` | Nuevo: ocho casos de render, selección, contrato y vuelto. |
| `test/unit/modules/invoices/invoiceItemsLayout.test.tsx` | Modificado: expectativas del breakpoint según panel, sin alterar aserciones de cálculo. |
| `test/unit/modules/invoices/paqueteFechaTipo.test.tsx` | Modificado: selección del tipo por etiqueta en vez de orden de los selectores; conserva íntegras las expectativas de fechas. |

El inventario `frontend/` contiene exclusivamente estos seis archivos.
Los archivos de ferries antiguos retirados del inventario de transporte NO
se deben eliminar del repositorio del front.

## Contrato y reglas conservadas

- Ruta `/invoices/emision`; mismo `borradorAPayloadEmision` y `POST /invoices/emitir`.
- `medio_pago` conserva sus siete valores existentes: EFECTIVO, YAPE, PLIN,
  TARJETA, TRANSFERENCIA, DEPOSITO y CHEQUE. Los tres botones son accesos
  directos; el selector conserva el catálogo completo.
- Crédito sigue siendo `forma_pago: 'Credito'` con sus cuotas y la habilitación
  vigente por tipo/cliente; no se introduce un valor CREDITO en `medio_pago`.
- Entrega/vuelto son estado local del componente visual, calculado en céntimos
  sobre el pago directo ya existente (descontados depósito BN y retención).
  No se envían ni modifican importes, cuotas ni validaciones. Una entrega
  insuficiente informa el pendiente sin añadir un bloqueo de emisión.
- Se reutilizan la búsqueda de cliente, campo único de boleta, consulta DNI/RUC,
  alta de cliente en modal, catálogo de productos, descuentos, almacén/serie,
  permiso por acción de la fecha y guardas de emisión/stock/tributos.
- La detracción sigue derivándose del SPOT de cada ítem; se conservan la
  liquidación y el medio de pago de detracción. El formulario modal de notas,
  sus reglas y los traductores de contrato no se modifican.
- Panel derecho con controles desplazables y liquidación/acción al final;
  altura medida respecto del viewport para mantenerlos visibles en escritorio.
  En móvil los paneles se apilan y se conserva un resumen compacto de pago.

## Verificación

- Suite completa final: **217 archivos, 1593 pruebas aprobadas,
  0 fallidas y 0 omitidas**. Incluye los ocho casos nuevos.
- Pruebas dirigidas iniciales: 30 aprobadas en tres archivos. Dirigidas finales:
  21 aprobadas en cinco archivos, incluidas las adaptaciones de layout.
- Build final `npm run build` (TypeScript + Vite): aprobado.
- Navegador Chromium local con API simulada: 1440, 1280, 1024, 768, 480 y 360px;
  sin desbordamiento horizontal ni errores de ejecución. En escritorio,
  liquidación y Emitir quedan dentro del viewport; en móvil permanece visible
  el resumen compacto. Comprobada también la tabla con un panel de 1168px.
- Estados, consultas, cálculos y función emitir previos al layout de la página:
  idénticos a la base. Sin cambios en servicios, tipos ni traductores del payload.
- ESLint de los seis archivos: **cuatro errores preexistentes, cero nuevos**.
  La comparación contra la página de la base reproduce las mismas ubicaciones:
  178:31 y 272:5 (`set-state-in-effect`), 178:133 y 178:178 (declaraciones
  posteriores usadas en el efecto de defaults). No se alteran en esta comisión.
- `git diff --check`: aprobado. `SHA256SUMS` cubre FERRY.md y los seis archivos.

La primera corrida completa detectó cinco fallos de presentación: duplicidad
textual del resumen móvil en tres consultas, breakpoint anterior y selección
por orden de un combobox. Se corrigieron antes de repetir la suite completa;
las expectativas de importes y de fechas se mantienen.

No se crean PRs, no se realizan merges ni despliegues, y no se accede a datos
compartidos o de producción.

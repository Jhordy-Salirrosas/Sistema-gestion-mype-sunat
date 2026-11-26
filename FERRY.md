# Ferry: retirar ayuda de atajos en Emisión

## Bases y destino

- Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
- Base back main: `9e0c87d165ebedd1eb0f75359149638beb09db38`.
- Rama de transporte: `ferry/m1-emision-quitar-ayuda-atajos`.
- Repositorio destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base front: `885bffb47b7921dd3553f3b9b3556b08c1f71e06`.
- Commit fuente local del front: `f8c9986df6c086a32971b58ca3a1e938983cbdd6`.
- Rama destino sugerida: `fix/m1-emision-quitar-ayuda-atajos`.

## Contenido exacto

Los archivos bajo `frontend/` coinciden byte a byte con el commit fuente. Sus rutas relativas a la raíz del front son:

- `src/modules/invoices/components/useInvoiceKeyboard.tsx`
- `src/modules/invoices/pages/InvoiceEmissionPage.tsx`
- `test/unit/modules/invoices/invoicePageKeyboard.test.tsx`

Diff conjunto respecto de la base front: **+6 −5**, en tres archivos. Se retiran la línea de ayuda y su fila vacía únicamente en la página de Emisión. Se separa el diálogo de revisión del texto compartido para conservar Ctrl+Enter y el modal de emisión sin cambios de comportamiento. Los manejadores de Alt+C, Alt+P, Alt+L, Ctrl+Enter, Escape y la navegación con flechas/Enter/Tab no se modifican. El test comprueba la ausencia de ayuda en la página y su permanencia en el modal.

## Verificación del commit fuente

- Suite completa: **225 archivos / 1676 pruebas verdes**.
- Build: **OK**.
- Lint global: **216 errores y 27 advertencias previos de main, sin hallazgos nuevos**. Los diagnósticos de main limpio y del cambio son idénticos tras normalizar rutas y espacios de formato. No se presenta el lint global como verde.

El ferry solo transporta esos mismos archivos; no modifica el cambio fuente ni requiere cambios en el backend.

## Aplicación

1. En la raíz de esta rama de transporte, ejecutar `sha256sum -c SHA256SUMS`. Deben verificarse las cuatro entradas: tres archivos frontend y FERRY.md.
2. Preparar la rama destino sobre la base front indicada. Si el destino avanzó, revisar los cambios de estas tres rutas antes de aplicar.
3. Copiar únicamente los tres archivos de `frontend/` a sus rutas relativas en la raíz del repositorio front, conservando sus directorios. No crear una carpeta frontend adicional en destino.
4. Verificar que el diff sobre la base sea +6 −5 y ejecutar las verificaciones del front según el tren de revisión.

**FERRY.md y SHA256SUMS son exclusivamente documentos de transporte en la rama ferry. No forman parte del cambio a producción y no se copian al repositorio front.** El prefijo `frontend/` tampoco forma parte de las rutas de destino. No se crea PR, no se despliega y no se reintenta el push al front.

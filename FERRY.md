# Ferry — segunda auditoría M1, Parte 1

Origen: https://github.com/CarlosSoles/Fronted-sistema-mype-sunat.git
Base frontend: c22b923272e0de9248a8bcc32f10237e636e7f6d (main).
Destino de transporte: repo del back, rama ferry/m1-auditoria-2-parte1.
No fusionar esta rama en el backend. Emma debe trasladar el diff del commit
al repo frontend manteniendo exactamente las rutas siguientes:

- src/modules/invoices/components/InvoiceIssuerConfigForm.tsx
- src/modules/invoices/hooks/useInvoiceConfig.ts
- src/modules/invoices/lib/invoiceEmitPayload.ts
- src/modules/invoices/lib/invoiceItems.ts
- test/unit/modules/invoices/invoiceD1Config.test.tsx
- test/unit/modules/invoices/invoiceEmitPayload.test.ts

Incluye edición de datos fiscales reales, precio final inicializado al seleccionar
producto y enviado siempre, y presentación fiel de certificado (estado, causa,
identificador y origen). Requiere el backend de fix/m1-auditoria-2, Parte 1,
y su migración generada, que aplica Emma. No incluye las Partes 2 o 3.
No modifica el entorno ausente ni las políticas de Resiliencia/certificado.
No contiene secretos. Sin PR, merge ni despliegue.

Validación: suite completa 96 archivos/753 pruebas aprobados; build y lint
aprobados. Backend asociado: 2eba7e0 (fix/m1-auditoria-2, Parte 1).

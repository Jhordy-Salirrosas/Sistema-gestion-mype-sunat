# Ferry M1 — verificación dev

Destino: Fronted-sistema-mype-sunat, rama dev. Base verificada:
`a3f723e9a80325024efa40c0cfddefc9f47aa1a4`. Commit local front: `191fc8b`.

Copiar únicamente estos archivos a sus rutas exactas:

- `src/modules/invoices/lib/invoiceLineasOrigen.ts`
- `test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx`
- `test/unit/modules/invoices/invoiceHistoricasContrato.test.ts`

No copiar archivos del backend ni este FERRY.md al frontend.
Corrección: notas conservan código de afectación y precio final históricos;
precio desconocido bloquea la precarga. Incluye contratos para 10/12/21/31/37/40.
Validación: suite completa 97 archivos/773 pruebas aprobadas; tsc --noEmit verde.
No requiere migraciones. No se abrió PR ni se fusionó/desplegó.

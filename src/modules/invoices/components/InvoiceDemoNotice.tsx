/**
 * Aviso de la consola fiscal del módulo M1.
 *
 * Se separa de `InvoiceList.tsx` para mantener el orquestador por debajo del
 * límite de líneas y poder cambiar el mensaje sin tocar la lógica de la vista.
 *
 * ESTE TEXTO ERA CIERTO HASTA EL SPRINT 2 Y YA NO LO ES. Decía que "la emisión
 * desde esta pantalla todavía se genera en el navegador y no persiste". Hoy el
 * modal de emisión llama a `POST /invoices/emitir`, que reserva el correlativo
 * y guarda el comprobante en la base: al actualizar, el comprobante SIGUE en el
 * listado porque es el real. Mantener el aviso habría sido vender un defecto
 * propio que ya no existe, justo en la pantalla que abre el docente.
 */
import { Alert, AlertDescription, AlertTitle } from '@/components/ui';
import { Info } from 'lucide-react';

/** Aviso sobre el origen de los comprobantes listados. */
export const InvoiceDemoNotice = () => (
  <Alert variant="info">
    <Info aria-hidden="true" />
    <AlertTitle>Consola fiscal · datos del backend</AlertTitle>
    <AlertDescription>
      Los comprobantes se consultan al backend con el tenant del token
      (GET /invoices) y la emisión se registra contra POST /invoices/emitir:
      lo que ves aquí viene de la base de datos, no de datos de demostración.
    </AlertDescription>
  </Alert>
);

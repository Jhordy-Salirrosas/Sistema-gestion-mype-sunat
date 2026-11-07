/**
 * Botón de envío del resumen diario de boletas (D11).
 *
 * QUÉ FALTABA
 *
 * El docente pidió poder enviar las boletas del día a SUNAT de una vez. El
 * backend sabía hacerlo desde hace semanas —`POST /resumenes/diario/enviar`
 * arma el XML, lo firma, lo comprime y lo encola—, pero la pantalla solo mostraba
 * la VISTA PREVIA. El propio código lo dejaba escrito: «No hay botón de enviar
 * aquí porque el envío real pasa por la cola de resúmenes, y fingirlo sería el
 * mismo error que inventar un CDR». La primera mitad era cierta; la segunda ya no,
 * porque la cola existe y está conectada.
 *
 * QUÉ HACE Y QUÉ NO PROMETE
 *
 * Al pulsar llama al endpoint y muestra la respuesta LITERAL del servidor.
 * Cuando SUNAT acepta el envío devuelve un TICKET, no un CDR: el veredicto
 * llega después por el worker de resúmenes. Por eso este botón nunca dice
 * «aceptado»; dice «enviado a la cola» con el identificador y el job.
 *
 * Se pide confirmación antes de enviar porque un RC es un acto ante la
 * administración: informa ventas y no se deshace con otro clic.
 */
import { useState } from 'react';
import { Button, PageText } from '@/components/ui';
import { Send } from 'lucide-react';
import { invoicesApi } from '../services/invoicesApi';
import type { ResultadoEnvioAgregado } from '../types/invoiceEnvioAgregado.types';

interface Props {
  /** Fecha de referencia del resumen (YYYY-MM-DD). */
  fecha: string;
  /** Identificador que se va a enviar, para la confirmación. */
  identificador: string;
  /** Cuántas líneas entrarían. */
  incluidos: number;
  /** ¿Hay algo que enviar? Sin líneas o con errores, no se ofrece el botón. */
  puedeEnviar: boolean;
  /** Se llama tras un envío exitoso para refrescar la vista. */
  onEnviado: () => void;
}

/** Envía el resumen diario y muestra el resultado real del backend. */
export const EnviarResumenDiarioBoton = ({
  fecha,
  identificador,
  incluidos,
  puedeEnviar,
  onEnviado,
}: Props) => {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEnvioAgregado | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    setResultado(null);
    try {
      const r = await invoicesApi.enviarResumenDiario(fecha);
      setResultado(r);
      setConfirmando(false);
      // Solo se refresca si de verdad se encoló: si el backend lo negó, la
      // vista sigue siendo la misma y recargarla daría la impresión de cambio.
      if (r.enviado) onEnviado();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo enviar el resumen a SUNAT.',
      );
    } finally {
      setEnviando(false);
    }
  };

  if (!puedeEnviar) {
    return (
      <PageText variant="caption">
        {incluidos === 0
          ? 'No hay ninguna boleta que informar en esta fecha: las que hay ya ' +
            'tienen su CDR de SUNAT (o están fuera del plazo), así que volver a ' +
            'enviarlas las duplicaría. El envío queda deshabilitado.'
          : 'No hay líneas que informar en esta fecha, así que no se ofrece el envío.'}
      </PageText>
    );
  }

  return (
    <div className="space-y-2">
      {!confirmando && (
        <Button size="sm" onClick={() => setConfirmando(true)} disabled={enviando}>
          <Send aria-hidden="true" className="mr-1" />
          Enviar resumen diario a SUNAT
        </Button>
      )}

      {confirmando && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <PageText variant="label">
            Confirmar envío de {identificador}
          </PageText>
          <PageText variant="caption">
            Se enviarán {incluidos} comprobante(s) a SUNAT. Esto informa ventas
            ante la administración y no se deshace con otro clic.
          </PageText>
          <PageText variant="caption">
            SUNAT responde con un TICKET; el CDR llega después y se consulta en
            el Monitor.
          </PageText>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void enviar()} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Sí, enviar ahora'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmando(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {resultado && (
        <div
          className={`rounded-lg border p-3 ${
            resultado.enviado
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-destructive/40 bg-destructive/5'
          }`}
        >
          <PageText variant="label">
            {resultado.enviado ? 'Enviado a la cola' : 'No se envió'}
          </PageText>
          <PageText variant="caption">
            {resultado.enviado
              ? `${resultado.identificador} con ${resultado.incluidos} línea(s). ` +
                'SUNAT devolverá un TICKET y el CDR se consulta en el Monitor: ' +
                'aquí todavía no hay veredicto.'
              : (resultado.motivo ?? 'El servidor no dio un motivo.')}
          </PageText>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <PageText variant="label" className="text-destructive">
            No se envió
          </PageText>
          <PageText variant="caption">{error}</PageText>
        </div>
      )}
    </div>
  );
};

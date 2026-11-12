import { useState } from 'react';
import { Button, PageText } from '@/components/ui';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import {
  invoicesApi,
  type ResultadoReprocesoPuente,
} from '../services/invoicesApi';

/** Recuperación exclusivamente local: ninguna consulta o reentrega a SUNAT. */
export function InvoiceBridgeReprocess({
  id,
  estado,
}: {
  id: string;
  estado: string;
}) {
  const { isAdmin } = useRolePermissions();
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoReprocesoPuente | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  if (!isAdmin || !['ACEPTADO', 'OBSERVADO'].includes(estado))
    return null;
  async function reprocesar() {
    if (procesando) return;
    setProcesando(true);
    setResultado(null);
    setError(null);
    try {
      setResultado(await invoicesApi.reprocesarPuente(id));
    } catch (cause) {
      setError(
        extractApiErrorMessage(cause, 'No se pudo reprocesar el puente.'),
      );
    } finally {
      setProcesando(false);
    }
  }
  return (
    <section
      aria-label="Puente contable y Kardex"
      className="space-y-2 rounded-lg border p-3"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={procesando}
        onClick={() => void reprocesar()}
      >
        {procesando ? 'Reprocesando puente…' : 'Reprocesar puente'}
      </Button>
      <PageText variant="caption">
        Recupera Kardex y asientos pendientes. No reenvía el comprobante a
        SUNAT.
      </PageText>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {resultado && (
        <div role="status" className="space-y-1">
          <PageText variant="label">
            {resultado.completo
              ? resultado.yaCompleto
                ? 'El puente ya estaba completo.'
                : 'Puente completado.'
              : 'El puente sigue pendiente.'}
          </PageText>
          <PageText variant="caption">
            Kardex: {resultado.kardex === 'COMPLETO' ? 'completo' : 'pendiente'}
          </PageText>
          {resultado.asientoId && (
            <PageText variant="caption">
              Asiento de venta: {resultado.asientoId}
            </PageText>
          )}
          {resultado.asientoCostoId && (
            <PageText variant="caption">
              Asiento de costo: {resultado.asientoCostoId}
              {resultado.costoVenta != null
                ? ` · S/ ${resultado.costoVenta.toFixed(2)}`
                : ''}
            </PageText>
          )}
          {resultado.errores.map((motivo, i) => (
            <p key={`${i}-${motivo}`} className="text-sm">
              {motivo}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

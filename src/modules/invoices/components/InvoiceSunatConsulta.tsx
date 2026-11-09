import { useState } from 'react';
import { Button, PageText } from '@/components/ui';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { invoicesApi, type ResultadoConsultaSunat } from '../services/invoicesApi';

/** Consulta explícita de estado, independiente de cualquier acción de envío. */
export const InvoiceSunatConsulta = ({ id }: { id: string }) => {
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsultaSunat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const consultar = async () => {
    if (consultando) return;
    setConsultando(true); setResultado(null); setError(null);
    try { setResultado(await invoicesApi.consultarSunat(id)); }
    catch (cause: unknown) { setError(extractApiErrorMessage(cause, 'No se pudo consultar el estado en SUNAT.')); }
    finally { setConsultando(false); }
  };
  return (
    <section aria-label="Consulta SUNAT" className="space-y-2 rounded-lg border p-3">
      <Button variant="outline" size="sm" disabled={consultando} onClick={() => void consultar()}>
        {consultando ? 'Consultando SUNAT…' : 'Consultar SUNAT'}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {resultado && <div role="status" className="space-y-1">
        <PageText variant="label">Resultado de consulta SUNAT</PageText>
        <PageText variant="caption">Estado: {resultado.tipo === 'RECUPERADO' ? resultado.estado : resultado.tipo}</PageText>
        <PageText variant="caption">Código: {resultado.tipo === 'RECUPERADO' ? resultado.codigo ?? 'No informado' : 'No informado'}</PageText>
        <PageText variant="caption">Mensaje: {resultado.tipo === 'RECUPERADO' ? resultado.mensaje ?? 'No informado' : resultado.tipo === 'INCIERTO' ? resultado.motivo : 'Comprobante no encontrado en SUNAT.'}</PageText>
      </div>}
    </section>
  );
};

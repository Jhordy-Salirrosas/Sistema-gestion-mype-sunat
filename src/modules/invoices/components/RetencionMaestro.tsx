import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/axios';

type Partner = { id: string; doc_type: string; doc_number: string };
type Estado = 'sin-documento' | 'consultando' | 'sin-registro' | 'sin-indicador' | 'error' | boolean;

export function RetencionMaestro({ documento, razonSocial, valor, onChange, disabled = false }: {
  documento: string; razonSocial: string; valor: boolean; onChange: (valor: boolean, correccion: boolean) => void; disabled?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>('sin-documento');
  const [revision, setRevision] = useState(0);
  const [creando, setCreando] = useState(false);
  const [errorCreacion, setErrorCreacion] = useState('');
  const onChangeRef = useRef(onChange);
  const documentoAnterior = useRef(documento);
  const cambioManual = useRef(false);
  onChangeRef.current = onChange;
  const tipo = documento.length === 11 ? '6' : documento.length === 8 ? '1' : '';

  useEffect(() => {
    let activo = true;
    if (documentoAnterior.current !== documento) {
      documentoAnterior.current = documento;
      cambioManual.current = false;
      onChangeRef.current(false, false);
    }
    if (!tipo) { setEstado('sin-documento'); return () => { activo = false; }; }
    setEstado('consultando');
    void apiClient.get<Partner[]>('/master-data/partners', { params: { q: documento } }).then(async ({ data }) => {
      const partner = data.find((p) => p.doc_type === tipo && p.doc_number === documento);
      if (!partner) return 'sin-registro' as const;
      const respuesta = await apiClient.get<Array<{ indicator: string; value: boolean }>>(`/master-data/partners/${encodeURIComponent(partner.id)}/tax-status`);
      return respuesta.data.find((item) => item.indicator === 'RETENCION')?.value ?? 'sin-indicador';
    }).then((resultado) => {
      if (!activo) return;
      setEstado(resultado);
      if (typeof resultado === 'boolean' && !cambioManual.current) onChangeRef.current(resultado, false);
    }).catch(() => { if (activo) setEstado('error'); });
    return () => { activo = false; };
  }, [documento, tipo, revision]);

  const crear = async () => {
    setCreando(true); setErrorCreacion('');
    try {
      await apiClient.post('/master-data/partners', { docType: tipo, docNumber: documento, legalName: razonSocial.trim(), roles: ['CLIENTE'] });
      setRevision((n) => n + 1);
    } catch { setErrorCreacion('No se pudo crear el cliente; puede continuar con selección manual.'); }
    finally { setCreando(false); }
  };
  const texto = estado === true ? 'Sí' : estado === false ? 'No' : estado === 'sin-registro' ? 'Sin registro en el maestro' : estado === 'sin-indicador' ? 'Sin indicador vigente' : estado === 'consultando' ? 'Consultando…' : estado === 'error' ? 'No se pudo consultar; selección manual' : 'Ingrese el documento del cliente';
  return <div className="space-y-1 text-sm">
    <p>Agente de retención según maestro: {texto}</p>
    <label className="flex items-center gap-2"><input type="checkbox" checked={valor} disabled={disabled} onChange={(e) => { cambioManual.current = true; onChange(e.target.checked, true); }} />Cliente es Agente de Retención del IGV (3%)</label>
    {typeof estado === 'boolean' && valor !== estado && <p role="status">La selección difiere del maestro; quedará registrada en la bitácora.</p>}
    {estado === 'sin-registro' && <button type="button" disabled={creando || !razonSocial.trim()} onClick={() => void crear()}>Crear cliente en el maestro</button>}
    {errorCreacion && <p role="alert">{errorCreacion}</p>}
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { PartnerFormDialog } from '@/modules/customs/components/PartnerFormDialog';
import { apiClient } from '@/lib/axios';

type Partner = { id: string; doc_type: string; doc_number: string };
type Estado = 'sin-documento' | 'consultando' | 'sin-registro' | 'sin-indicador' | 'error' | boolean;

export function RetencionMaestro({ documento, razonSocial, valor, onChange, disabled = false }: {
  documento: string; razonSocial: string; valor: boolean; onChange: (valor: boolean, correccion: boolean) => void; disabled?: boolean;
}) {
  const { canEmitInvoices } = useRolePermissions();
  const [creando, setCreando] = useState(false);
  const onChangeRef = useRef(onChange);
  const documentoAnterior = useRef(documento);
  const cambioManual = useRef(false);
  onChangeRef.current = onChange;
  const tipo = documento.length === 11 ? '6' : documento.length === 8 ? '1' : '';

  const taxStatus = useQuery({
    queryKey: ['master-data', 'partner-tax-status', tipo, documento],
    enabled: !!tipo,
    retry: false,
    queryFn: async (): Promise<Estado> => {
      const { data } = await apiClient.get<Partner[]>('/master-data/partners', { params: { q: documento } });
      const partner = data.find((p) => p.doc_type === tipo && p.doc_number === documento);
      if (!partner) return 'sin-registro';
      const respuesta = await apiClient.get<Array<{ indicator: string; value: boolean }>>(`/master-data/partners/${encodeURIComponent(partner.id)}/tax-status`);
      return respuesta.data.find((item) => item.indicator === 'RETENCION')?.value ?? 'sin-indicador';
    },
  });
  const estado: Estado = !tipo ? 'sin-documento' : taxStatus.isFetching ? 'consultando' : taxStatus.isError ? 'error' : taxStatus.data ?? 'consultando';
  useEffect(() => {
    if (documentoAnterior.current !== documento) {
      documentoAnterior.current = documento;
      cambioManual.current = false;
      onChangeRef.current(false, false);
    }
    if (typeof estado === 'boolean' && !cambioManual.current) onChangeRef.current(estado, false);
  }, [documento, estado]);

  const texto = estado === true ? 'Sí' : estado === false ? 'No' : estado === 'sin-registro' ? 'Sin registro en el maestro' : estado === 'sin-indicador' ? 'Sin indicador vigente' : estado === 'consultando' ? 'Consultando…' : estado === 'error' ? 'No se pudo consultar; selección manual' : 'Ingrese el documento del cliente';
  return <div className="space-y-1 text-sm">
    <p>Agente de retención según maestro: {texto}</p>
    <label className="flex items-center gap-2"><input type="checkbox" checked={valor} disabled={disabled} onChange={(e) => { cambioManual.current = true; onChange(e.target.checked, true); }} />Cliente es Agente de Retención del IGV (3%)</label>
    {typeof estado === 'boolean' && valor !== estado && <p role="status">La selección difiere del maestro; quedará registrada en la bitácora.</p>}
    {estado === 'sin-registro' && canEmitInvoices && !disabled && <button type="button" onClick={() => setCreando(true)}>Crear cliente en el maestro</button>}
    {creando && canEmitInvoices && !disabled && <PartnerFormDialog initialRole="CLIENTE" requiredRole="CLIENTE" initialDocument={documento} initialName={razonSocial} onClose={() => setCreando(false)} /> }
  </div>;
}

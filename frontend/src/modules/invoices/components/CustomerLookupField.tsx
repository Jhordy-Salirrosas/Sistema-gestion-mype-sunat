import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { masterDataApi, type BusinessPartnerRecord } from '@/modules/customs/services/masterDataApi';
import { PartnerFormDialog } from '@/modules/customs/components/PartnerFormDialog';
import { PageText } from '@/components/ui';
import { ESPERA_MS, MINIMO_CARACTERES, type ClienteBuscado } from '../lib/invoiceSearch';

export const partnerToCustomer = (p: BusinessPartnerRecord): ClienteBuscado => {
  const tieneCredito = p.has_credit === true;
  const admiteDescuento =
    typeof p.allows_discount === 'boolean' ? p.allows_discount : undefined;
  return {
    id: p.id,
    tipoDocumento: p.doc_type,
    numeroDocumento: p.doc_number,
    razonSocial: p.legal_name,
    direccion: p.address ?? undefined,
    ...(tieneCredito !== undefined ? { tieneCredito } : {}),
    ...(admiteDescuento !== undefined ? { admiteDescuento } : {}),
  };
};

type Campo = 'documento' | 'nombre';
interface CustomerLookupFieldProps {
  documento: string;
  razonSocial: string;
  onElegir: (cliente: ClienteBuscado) => void;
  onDocumentoChange?: (documento: string) => void;
  onRazonSocialChange?: (razonSocial: string) => void;
  labelDocumento: string;
  placeholderDocumento?: string;
  errorDocumento?: string;
  disabled?: boolean;
}

/** Busca clientes activos del maestro desde cualquiera de los dos campos. */
export const CustomerLookupField = ({ documento, razonSocial, onElegir, onDocumentoChange, onRazonSocialChange, labelDocumento, placeholderDocumento, errorDocumento, disabled = false }: CustomerLookupFieldProps) => {
  const queryClient = useQueryClient();
  const { canEmitInvoices } = useRolePermissions();
  const [registering, setRegistering] = useState(false);
  const elegir = (cliente: ClienteBuscado) => {
    onElegir(cliente);
    setConsulta(null);
    void queryClient.invalidateQueries({ queryKey: ['master-data', 'partner-tax-status'] });
  };
  const contenedor = useRef<HTMLDivElement | null>(null);
  const [consulta, setConsulta] = useState<{ campo: Campo; texto: string } | null>(null);
  const [respuesta, setRespuesta] = useState<{ campo: Campo; texto: string; clientes: readonly ClienteBuscado[]; error: boolean } | null>(null);
  const texto = consulta?.texto.trim() ?? '';
  const buscando = !disabled && !!consulta && texto.length >= MINIMO_CARACTERES;
  const vigente = buscando && respuesta?.campo === consulta?.campo && respuesta?.texto === texto;

  useEffect(() => {
    if (disabled || !consulta || texto.length < MINIMO_CARACTERES) return;
    let viva = true;
    const timer = window.setTimeout(() => {
      void queryClient.fetchQuery({ queryKey: ['master-data', 'partners', 'CLIENTE', texto], queryFn: () => masterDataApi.getPartners({ role: 'CLIENTE', q: texto }), staleTime: 0, retry: false }).then((partners) => {
        const clientes = partners.filter((p) => p.is_active && p.roles.includes('CLIENTE')).map(partnerToCustomer);
        if (viva) setRespuesta({ campo: consulta.campo, texto, clientes, error: false });
      }).catch(() => {
        if (viva) setRespuesta({ campo: consulta.campo, texto, clientes: [], error: true });
      });
    }, ESPERA_MS);
    return () => { viva = false; window.clearTimeout(timer); };
  }, [consulta, texto, queryClient, disabled]);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setConsulta(null);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const lista = (campo: Campo) => consulta?.campo === campo && buscando ? (
    !vigente ? <PageText role="status" variant="caption">Buscando en el maestro…</PageText> : respuesta?.error ? (
      <PageText role="alert" variant="error">No se pudo buscar en el maestro. Vuelva a intentarlo.</PageText>
    ) : respuesta?.clientes.length ? (
      <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-background shadow">
        {respuesta.clientes.map((cliente) => <li key={`${cliente.tipoDocumento}-${cliente.numeroDocumento}`}>
          <button data-customer-option type="button" className="w-full px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => { elegir(cliente); }}>
            <span className="block font-medium">{cliente.razonSocial || '(sin razón social)'}</span>
            <span className="block text-muted-foreground">{cliente.tipoDocumento === '6' ? 'RUC' : 'DNI'} {cliente.numeroDocumento}</span>
          </button>
        </li>)}
      </ul>
    ) : <PageText variant="caption">Sin coincidencias en el maestro. Puede escribirlo a mano.</PageText>
  ) : null;

  const navegar = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') { setConsulta(null); return; }
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const opciones = [...(contenedor.current?.querySelectorAll<HTMLButtonElement>('button[data-customer-option]') ?? [])];
    if (!opciones.length) return; e.preventDefault();
    const actual = opciones.indexOf(document.activeElement as HTMLButtonElement);
    opciones[(actual + (e.key === 'ArrowDown' ? 1 : opciones.length - 1) + opciones.length) % opciones.length]?.focus();
  };
  return <div onKeyDown={navegar} ref={contenedor} className="contents">
    <div className="relative space-y-1">
      <label htmlFor="doc-cliente" className="text-xs font-medium">{labelDocumento}<span aria-hidden="true"> *</span></label>
      <input aria-label={labelDocumento} aria-required={!disabled} aria-invalid={!disabled && Boolean(errorDocumento || !documento.trim())} aria-describedby="doc-cliente-error" disabled={disabled} id="doc-cliente" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={documento} placeholder={placeholderDocumento} autoComplete="off"
        onFocus={() => { setRespuesta(null); setConsulta({ campo: 'documento', texto: documento }); }}
        onChange={(e) => { const valor = e.target.value.replace(/\D/g, ''); onDocumentoChange?.(valor); setRespuesta(null); setConsulta({ campo: 'documento', texto: valor }); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setConsulta(null); }} />
      {!disabled && (errorDocumento || !documento.trim()) && <PageText id="doc-cliente-error" variant="error">{errorDocumento || "Indique el documento del cliente."}</PageText>}
      {lista('documento')}
    </div>
    <div className="relative space-y-1">
      <label htmlFor="razon-cliente" className="text-xs font-medium">Razón social / nombre<span aria-hidden="true"> *</span></label>
      <input maxLength={1500} aria-label="Razón social / nombre" aria-required={!disabled} aria-invalid={!disabled && !razonSocial.trim()} aria-describedby="razon-cliente-error" disabled={disabled} id="razon-cliente" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={razonSocial} placeholder="FERRETERÍA LOS ANDES S.A.C." autoComplete="off"
        onFocus={() => { setRespuesta(null); setConsulta({ campo: 'nombre', texto: razonSocial }); }}
        onChange={(e) => { const valor = e.target.value; onRazonSocialChange?.(valor); setRespuesta(null); setConsulta({ campo: 'nombre', texto: valor }); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setConsulta(null); }} />
      {!disabled && !razonSocial.trim() && <PageText id="razon-cliente-error" variant="error">Indique la razón social o nombre del cliente.</PageText>}
      {lista('nombre')}
    </div>
    {!disabled && canEmitInvoices && <button type="button" className="text-xs text-primary underline" onClick={() => { setConsulta(null); setRegistering(true); }}>Registrar cliente nuevo</button>}
    {registering && canEmitInvoices && <PartnerFormDialog enableRucLookup initialRole="CLIENTE" requiredRole="CLIENTE" initialDocument={documento} initialName={razonSocial} onClose={() => setRegistering(false)} onSaved={(partner) => elegir(partnerToCustomer(partner))} />}
  </div>;
};

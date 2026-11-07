import { useEffect, useRef, useState } from 'react';
import { PageText } from '@/components/ui';
import { invoicesApi } from '../services/invoicesApi';
import { ESPERA_MS, MINIMO_CARACTERES, type ClienteBuscado } from '../lib/invoiceSearch';

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
}

/** Busca en la cartera de la empresa desde cualquiera de los dos campos. */
export const CustomerLookupField = ({ documento, razonSocial, onElegir, onDocumentoChange, onRazonSocialChange, labelDocumento, placeholderDocumento, errorDocumento }: CustomerLookupFieldProps) => {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const [consulta, setConsulta] = useState<{ campo: Campo; texto: string } | null>(null);
  const [respuesta, setRespuesta] = useState<{ campo: Campo; texto: string; clientes: readonly ClienteBuscado[]; error: boolean } | null>(null);
  const texto = consulta?.texto.trim() ?? '';
  const buscando = !!consulta && texto.length >= MINIMO_CARACTERES;
  const vigente = buscando && respuesta?.campo === consulta?.campo && respuesta?.texto === texto;

  useEffect(() => {
    if (!consulta || texto.length < MINIMO_CARACTERES) return;
    let viva = true;
    const timer = window.setTimeout(() => {
      void invoicesApi.buscarClientes(texto).then((clientes) => {
        if (viva) setRespuesta({ campo: consulta.campo, texto, clientes, error: false });
      }).catch(() => {
        if (viva) setRespuesta({ campo: consulta.campo, texto, clientes: [], error: true });
      });
    }, ESPERA_MS);
    return () => { viva = false; window.clearTimeout(timer); };
  }, [consulta, texto]);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setConsulta(null);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const lista = (campo: Campo) => consulta?.campo === campo && buscando ? (
    !vigente ? <PageText role="status" variant="caption">Buscando en la cartera…</PageText> : respuesta?.error ? (
      <PageText role="alert" variant="error">No se pudo buscar en la cartera. Vuelva a intentarlo.</PageText>
    ) : respuesta?.clientes.length ? (
      <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-background shadow">
        {respuesta.clientes.map((cliente) => <li key={`${cliente.tipoDocumento}-${cliente.numeroDocumento}`}>
          <button type="button" className="w-full px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => { onElegir(cliente); setConsulta(null); }}>
            <span className="block font-medium">{cliente.razonSocial || '(sin razón social)'}</span>
            <span className="block text-muted-foreground">{cliente.tipoDocumento === '6' ? 'RUC' : 'DNI'} {cliente.numeroDocumento}</span>
          </button>
        </li>)}
      </ul>
    ) : <PageText variant="caption">Sin coincidencias en su cartera. Puede escribirlo a mano.</PageText>
  ) : null;

  return <div ref={contenedor} className="contents">
    <div className="relative space-y-1">
      <label htmlFor="doc-cliente" className="text-xs font-medium">{labelDocumento}</label>
      <input id="doc-cliente" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={documento} placeholder={placeholderDocumento} autoComplete="off"
        onFocus={() => { setRespuesta(null); setConsulta({ campo: 'documento', texto: documento }); }}
        onChange={(e) => { const valor = e.target.value.replace(/\D/g, ''); onDocumentoChange?.(valor); setRespuesta(null); setConsulta({ campo: 'documento', texto: valor }); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setConsulta(null); }} />
      {errorDocumento && <PageText variant="error">{errorDocumento}</PageText>}
      {lista('documento')}
    </div>
    <div className="relative space-y-1">
      <label htmlFor="razon-cliente" className="text-xs font-medium">Razón social / nombre</label>
      <input id="razon-cliente" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={razonSocial} placeholder="FERRETERÍA LOS ANDES S.A.C." autoComplete="off"
        onFocus={() => { setRespuesta(null); setConsulta({ campo: 'nombre', texto: razonSocial }); }}
        onChange={(e) => { const valor = e.target.value; onRazonSocialChange?.(valor); setRespuesta(null); setConsulta({ campo: 'nombre', texto: valor }); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setConsulta(null); }} />
      {lista('nombre')}
    </div>
  </div>;
};

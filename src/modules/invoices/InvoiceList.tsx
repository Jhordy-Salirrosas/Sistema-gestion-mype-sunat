import type { Invoice } from './types/invoice.types';
import { clasificarBandeja, ETIQUETAS_BANDEJA } from './lib/invoiceBandejaState';
import { Link } from 'react-router-dom';
import { InvoiceWait } from './components/InvoiceWait';
import { InvoiceUxPage as Page } from './components/InvoiceUxPage';
import { enriquecerImportesBandeja } from './lib/invoiceBandejaAmounts';
import { useInvoiceRefresh } from './hooks/useInvoiceRefresh';
/**
 * Orquestador de la vista principal del módulo de Facturación (M1).
 *
 * Integra las tarjetas KPI fiscales, la barra de filtros,
 * la grilla enriquecida de comprobantes,
 * el detalle de auditoría CDR y el formulario compartido de notas.
 *
 * Los filtros y el apartado activo se aplican al conjunto sobre el que se
 * calculan los KPI y el monitor Outbox, no solo a la grilla: si el usuario
 * filtra "Rechazado", las tarjetas también deben mostrar ese subconjunto.
 * El aviso de la consola fiscal deja constancia de que la emisión real contra
 * el backend está planificada para el Sprint 2.
 */
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  PageHeader,
} from '@/components/ui';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { formatCurrency } from '@/lib/formatters';
import type { ComprobanteDemo } from './data/invoiceDemoTypes';
import { InvoiceCombinedSummary } from './components/InvoiceCombinedSummary';
import { InvoiceKpiCards } from './components/InvoiceKpiCards';
import { InvoiceDemoNotice } from './components/InvoiceDemoNotice';
import { sectionFromPath, type InvoiceSectionId } from './lib/invoiceSections';
import {
  InvoiceFiltersBar,
  type InvoiceFiltros,
} from './components/InvoiceFiltersBar';
import { InvoiceTable } from './components/InvoiceTable';
import { InvoiceCdrModal } from './components/InvoiceCdrModal';
import { InvoiceEmissionForm } from './components/InvoiceEmissionForm';
import { calcularResumenFiscal } from './lib/invoiceMetrics';
import { aComprobanteDemo } from './lib/invoiceApiMapper';
import { invoicesApi } from './services/invoicesApi';
import { aplicarFiltros, porApartado } from './lib/invoiceFilters';
import { descargarDesdeBackend } from './lib/invoiceDescarga';
import { useInvoiceFiltros } from './lib/useInvoiceFiltros';

const FILTROS_INICIALES: InvoiceFiltros = {
  busqueda: '',
  estado: 'TODOS',
  desde: '',
  hasta: '',
};

/**
 * Fecha `YYYY-MM-DD` en la zona horaria del equipo, no en UTC.
 *
 * Un comprobante emitido a las 20:00 en Lima sigue siendo del mismo día
 * calendario; `toISOString()` lo habría fechado un día antes.
 */
export const fechaLocalIso = (d: Date): string => {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

/** Indica si el usuario está viendo un subconjunto y no el periodo completo. */
const hayFiltrosActivos = (
  filtros: InvoiceFiltros,
  tab: InvoiceSectionId,
): boolean =>
  tab !== 'comprobantes' ||
  filtros.busqueda.trim() !== '' ||
  filtros.estado !== 'TODOS' ||
  filtros.desde !== '' ||
  filtros.hasta !== '';

interface VisorState {
  comprobante: ComprobanteDemo;
  modo: 'cdr' | 'xml';
}

export const InvoiceList = () => {
  const cache=useQueryClient();
  const reflejarDetalle=useCallback((detalle:Invoice)=>{cache.setQueryData<{data:Invoice[]}>(['invoices',1],prev=>prev?({...prev,data:prev.data.map(item=>item.id===detalle.id?{...item,...detalle,importesBandeja:detalle.importesBandeja??item.importesBandeja}:item)}):prev);},[cache]);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const activeSection = sectionFromPath(pathname);
  const detalleModal = activeSection === 'comprobantes' || activeSection === 'notas';
  const incluirNotas=activeSection==='comprobantes'&&new URLSearchParams(search).get('incluir_notas')==='1';
  const [filtros, setFiltros] = useInvoiceFiltros();
  const [visor, setVisor] = useState<VisorState | null>(null);
  // Este aviso queda para un fallo
  // anterior a esa llamada.
  const [errorEmision] = useState<string | null>(null);
  const [avisoCdr, setAvisoCdr] = useState<string | null>(null);

  const {
    data: pagina,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['invoices', 1],
    queryFn: async () => {
      const primera = await invoicesApi.getInvoices(1, { page_size: 100 });
      const paginas = await Promise.all(
        Array.from({ length: Math.max(0, primera.totalPages - 1) }, (_, i) =>
          invoicesApi.getInvoices(i + 2, { page_size: 100 }),
        ),
      );
      return { ...primera, data: await enriquecerImportesBandeja([ ...primera.data, ...paginas.flatMap((p) => p.data) ], invoicesApi.getInvoiceById) };
    },
    staleTime: 1000 * 60 * 3,
  });

  /** Listado real del tenant; se refresca tras cada emisión. */
  const comprobantes = useMemo<readonly ComprobanteDemo[]>(
    () => pagina?.data.map(aComprobanteDemo) ?? [],
    [pagina],
  );

  /** Lote filtrado que alimenta KPIs, monitor y grilla. */
  const visibles = useMemo(
    () => aplicarFiltros(incluirNotas?comprobantes.filter(c=>['01','03','07','08'].includes(c.tipo)):porApartado(comprobantes, activeSection), filtros),
    [comprobantes, activeSection, filtros, incluirNotas],
  );

  const resumen = useMemo(
    () => calcularResumenFiscal(visibles),
    [visibles],
  );

  const resumenCombinado = useMemo(
    () => calcularResumenFiscal(aplicarFiltros(comprobantes, filtros)),
    [comprobantes, filtros],
  );

  /** Reencola un comprobante en error para que el worker vuelva a pedir su CDR. */
  const reintentarCdr = useCallback(
    async (comprobante: ComprobanteDemo) => {
      try {
        const resultado = await invoicesApi.retryCdr(comprobante.id);
        setAvisoCdr(resultado.mensaje);
        if (resultado.encolado) await refetch();
      } catch {
        setAvisoCdr('No se pudo reencolar el comprobante en la cola.');
      }
    },
    [refetch],
  );

  const refresco = useInvoiceRefresh();

  /** Grilla de comprobantes con los visores XML/CDR y la descarga PDF. */
  const grilla = (mensajeVacio?: string, documentos = visibles) => isLoading ? <InvoiceWait label="Cargando comprobantes…" skeleton /> : !isError && documentos.length === 0 ? (
    <section className="rounded-lg border p-6" aria-label="Bandeja sin resultados">
      <h2 className="font-semibold">{comprobantes.length ? 'No hay comprobantes para los filtros elegidos' : 'Aún no emites comprobantes'}</h2>
      {comprobantes.length ? <button className="mt-3 rounded border px-3 py-2" onClick={() => setFiltros({ ...FILTROS_INICIALES },true)}>Limpiar filtros</button> : <Link className="mt-3 inline-block rounded border px-3 py-2" to="/invoices/emision">Emitir el primero</Link>}
      {mensajeVacio && <p className="text-sm">{mensajeVacio}</p>}
    </section>
  ) : (
    <InvoiceTable
      key={JSON.stringify(filtros)}
      comprobantes={documentos}
      sinAcciones={detalleModal}
      mensajeVacio={
        isLoading
          ? 'Cargando comprobantes…'
          : isError
            ? 'No se pudieron cargar los comprobantes del backend.'
            : mensajeVacio
      }
      onVerXml={(c) => setVisor({ comprobante: c, modo: 'xml' })}
      onVerCdr={(c) => setVisor({ comprobante: c, modo: 'cdr' })}
      onDescargarPdf={(c) => { void descargarDesdeBackend(c.id, 'pdf').catch((error: unknown) => setAvisoCdr(extractApiErrorMessage(error, 'No se pudo descargar el PDF.'))); }}
      onReintentarCdr={reintentarCdr}
    />
  );


  return (
    <Page className={activeSection === 'notas' ? 'm1-notas-integradas' : undefined}>
      <PageHeader
        title={activeSection === 'notas' ? 'Notas' : incluirNotas ? 'Comprobantes del periodo' : 'Facturas y boletas'}
        description="Emisión, consulta y seguimiento de comprobantes electrónicos sincronizados con SUNAT"
      />

      {errorEmision && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo emitir</AlertTitle>
          <AlertDescription>{errorEmision}</AlertDescription>
        </Alert>
      )}

      {avisoCdr && (
        <Alert variant="info">
          <AlertTitle>Reintento de CDR</AlertTitle>
          <AlertDescription>{avisoCdr}</AlertDescription>
        </Alert>
      )}

      {refresco.resultado && <p role={refresco.resultado.ok ? 'status' : 'alert'}>{refresco.resultado.mensaje}</p>}
      {activeSection === 'notas' && <section aria-labelledby="emision-notas" className="min-w-0 space-y-4">
        <h2 id="emision-notas" className="text-lg font-semibold">Emisión de notas</h2>
        <InvoiceEmissionForm soloNotas />
      </section>}
      {activeSection === 'notas' && <h2 className="text-lg font-semibold">Notas emitidas</h2>}
      <InvoiceDemoNotice />
      <p className="sr-only" role="status" aria-live="polite">{visibles.length} comprobantes en la vista. {visibles.map(c => `${c.serie}-${c.correlativo}: ${ETIQUETAS_BANDEJA[clasificarBandeja(c)]}`).join('; ')}</p>

      {filtros.desde && filtros.hasta && filtros.desde > filtros.hasta && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Rango de fechas inválido</AlertTitle>
          <AlertDescription>La fecha Desde debe ser anterior o igual a Hasta.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <InvoiceFiltersBar
          filtros={filtros}
          onFiltrosChange={setFiltros}
          onLimpiar={()=>setFiltros({...FILTROS_INICIALES},true)}
          onActualizar={() => { void refresco.actualizar(); }}
          actualizando={refresco.actualizando}
          ultimaActualizacion={refresco.ultimaActualizacion}
        />

      {isLoading ? (
        <InvoiceWait label="Cargando indicadores…" skeleton />
      ) : !isError && activeSection !== 'notas' ? (
        <InvoiceKpiCards mostrarNotas={false} resumen={resumen} filtrado={hayFiltrosActivos(filtros, activeSection)} />
      ) : null}

      {activeSection === 'comprobantes' && !isLoading && !isError && (
        <InvoiceCombinedSummary resumen={resumenCombinado} />
      )}





        {activeSection === 'comprobantes' && <section className="flex-1 outline-none">
          {incluirNotas&&<button className="mb-3 rounded border px-3 py-2 text-sm" onClick={()=>{const params=new URLSearchParams(search);params.delete('incluir_notas');navigate({pathname,search:params.toString()},{replace:true});}}>Tipos: facturas, boletas y notas · Quitar filtro</button>}
          {grilla()}
        </section>}

        {activeSection === 'notas' && <section data-notes-list className="min-w-0 outline-none">
          {([
            {
              tipo: '07', titulo: 'Notas de crédito',
              total: 'Total de notas de crédito', importe: resumen.acreditado,
              vacio: 'No hay notas de crédito con los filtros aplicados.',
            },
            {
              tipo: '08', titulo: 'Notas de débito',
              total: 'Total de notas de débito', importe: resumen.debitado,
              vacio: 'No hay notas de débito con los filtros aplicados.',
            },
          ] as const).map(({ tipo, titulo, total, importe, vacio }) => {
            // `tipo` procede de tipo_comprobante mediante aComprobanteDemo.
            const documentos = visibles.filter((c) => c.tipo === tipo);
            return (
              <section key={tipo} aria-labelledby={`notas-${tipo}`} className="space-y-3 mb-6">
                <h2 id={`notas-${tipo}`} className="text-lg font-semibold">{titulo}</h2>
                <p>{documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'}</p>
                {grilla(vacio, documentos)}
                <p className="font-semibold">{total}: {formatCurrency(importe, 'PEN')}</p>
              </section>
            );
          })}
        </section>}

        {activeSection === 'bajas' && <section className="flex-1 outline-none">
          {grilla('No hay bajas ni resúmenes diarios en el periodo.')}
        </section>}
      </div>

      {visor && (
        <InvoiceCdrModal
          lateral={!detalleModal}
          onReintentarCdr={detalleModal ? reintentarCdr : undefined}
          onActualizado={reflejarDetalle}
          comprobante={visor.comprobante}
          modoInicial={visor.modo}
          onCerrar={() => {
            const id = visor.comprobante.id;
            setVisor(null);
            if (detalleModal) requestAnimationFrame(() => {
              Array.from(document.querySelectorAll<HTMLElement>('[data-invoice-id]')).find(row => row.dataset.invoiceId === id)?.focus();
            });
          }}
        />
      )}
    </Page>
  );
};

export default InvoiceList;

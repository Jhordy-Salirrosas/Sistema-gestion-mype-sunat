import { InvoiceForcedResend } from './InvoiceForcedResend';
import { lecturaRechazo } from '../lib/invoiceResultPresentation';
/**
 * Modal de auditoría CDR y visor XML del comprobante (M1).
 *
 * Muestra la respuesta oficial del `billService` de SUNAT (código,
 * descripción, Hash y trama QR), la bitácora del pipeline de envío y, en modo
 * XML, el documento UBL 2.1 completo con scroll.
 */
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PageText,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { Download, FileCode2 } from 'lucide-react';
import type { ComprobanteDemo } from '../data/invoiceDemoTypes';
import { generarTramaQrSunat } from '../lib/invoiceCreditAndRules';
import { useIdentidadEmisora } from '../lib/invoiceExportConstants';
import {
  descargarDesdeBackend,
  extraerDigestValue,
  obtenerXmlDesdeBackend,
  type FormatoDescarga,
} from '../lib/invoiceDescarga';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { InvoiceBridgeReprocess } from './InvoiceBridgeReprocess';
import { InvoiceSunatConsulta } from './InvoiceSunatConsulta';
import { InvoiceAuditTrail } from './InvoiceAuditTrail';
import { invoicesApi } from '../services/invoicesApi';
import type { Invoice } from '../types/invoice.types';
import { leerTributosXml, NOMBRES_AFECTACION, NOMBRES_TRIBUTO, requiereRevisionContableXml, rotularCodigo } from '../lib/invoiceTributosXml';

interface InvoiceCdrModalProps {
  comprobante: ComprobanteDemo | null;
  /** Pestaña inicial: 'cdr' (auditoría) o 'xml' (documento). */
  modoInicial?: 'cdr' | 'xml';
  onCerrar: () => void;
}

/** Modal de auditoría CDR con visor del XML UBL 2.1. */
export const InvoiceCdrModal = ({
  comprobante,
  modoInicial = 'cdr',
  onCerrar,
}: InvoiceCdrModalProps) => {
  const emisor = useIdentidadEmisora();
  const [modo, setModo] = useState<'cdr' | 'xml'>(modoInicial);
  const [descargando, setDescargando] = useState<FormatoDescarga | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  /**
   * XML firmado que devuelve el backend.
   *
   * `undefined` = todavía no se pidió; `null` = se pidió y no hay archivo. La
   * distinción evita tener que marcar "cargando" con un `setState` síncrono
   * dentro del efecto, que dispara renders en cascada.
   */
  const [xmlReal, setXmlReal] = useState<string | null | undefined>(undefined);
  const [historialCargado, setHistorialCargado] = useState<{ id: string; eventos?: Invoice['historial']; tieneCdr?: boolean; comprobanteOrigen?: Invoice['comprobanteOrigen']; resultado?: Invoice['resultadoPresentacion']; ultimoErrorCodigo?: string; ultimoErrorMensaje?: string; error?: boolean } | null>(null);

  const idComprobante = comprobante?.id ?? null;

  useEffect(() => {
    if (!idComprobante) return;
    let vigente = true;
    void Promise.resolve().then(() => invoicesApi.getInvoiceById(idComprobante)).then((detalle) => {
      if (vigente) setHistorialCargado({ id: idComprobante, eventos: detalle.historial ?? [], tieneCdr: detalle.tieneCdr ?? Boolean(detalle.cdrCodigo), comprobanteOrigen: detalle.comprobanteOrigen ?? null, resultado: detalle.resultadoPresentacion, ultimoErrorCodigo: detalle.ultimoErrorCodigo, ultimoErrorMensaje: detalle.ultimoErrorMensaje });
    }).catch(() => { if (vigente) setHistorialCargado({ id: idComprobante, error: true }); });
    return () => { vigente = false; };
  }, [idComprobante]);

  /**
   * Trae el XML firmado del backend.
   *
   * Se pide en el `useEffect` y no en el render porque es una petición de red:
   * llamarla en el cuerpo del componente la repetiría en cada repintado. El
   * `id` del comprobante es la dependencia real.
   */
  useEffect(() => {
    if (!idComprobante) return;
    let vigente = true;
    void obtenerXmlDesdeBackend(idComprobante).then((xml) => {
      if (vigente) setXmlReal(xml);
    });
    return () => {
      vigente = false;
    };
  }, [idComprobante]);

  if (!comprobante) return null;

  const ficha = historialCargado?.id === comprobante.id && !historialCargado.error ? historialCargado : null;
  const c = { ...comprobante, resultadoPresentacion: ficha?.resultado ?? comprobante.resultadoPresentacion, ultimoErrorCodigo: ficha?.ultimoErrorCodigo ?? comprobante.ultimoErrorCodigo, ultimoErrorMensaje: ficha?.ultimoErrorMensaje ?? comprobante.ultimoErrorMensaje };
  const rechazo = (c.estado === 'RECHAZADO' || ['PREPARACION_LOCAL', 'RA_REVERSAL_PENDING', 'RA_REVERSAL_DONE', 'BRIDGE_PENDING'].includes(c.resultadoPresentacion?.origen ?? '')) ? lecturaRechazo(c.resultadoPresentacion) : null;

  /**
   * Pide el documento al backend y lo guarda.
   *
   * Si el backend responde 404 se muestra el motivo (un comprobante PENDIENTE
   * todavía no tiene CDR) en lugar de bajar un archivo vacío o inventado.
   */
  const descargar = async (formato: FormatoDescarga) => {
    setDescargando(formato);
    setErrorDescarga(null);
    try {
      await descargarDesdeBackend(c.id, formato);
    } catch (error: unknown) {
      setErrorDescarga(extractApiErrorMessage(error, 'No se pudo descargar el documento.'));
    } finally {
      setDescargando(null);
    }
  };
  // El correlativo se rellena a 8 dígitos, como en el documento fiscal real.
  // Antes se usaba padStart(4) y el título mostraba "FC01-0004" para
  // FC01-00000004: un número que no existe en SUNAT.
  const numeroSerie = `${c.serie}-${String(c.correlativo).padStart(8, '0')}`;

  /**
   * Etiqueta del código de respuesta.
   *
   * Un comprobante RECHAZADO no puede rotularse "PENDIENTE": son estados
   * fiscales opuestos. Cuando el rechazo llega como SOAP Fault, SUNAT no
   * devuelve CDR y `cdrCodigo` queda vacío, así que antes esta línea escribía
   * "Código PENDIENTE" sobre una factura que SUNAT ya había tirado. Ese caso se
   * señala con "sin código de CDR" en lugar de inventar un estado.
   */
  const etiquetaCodigo = (() => {
    if (rechazo) return rechazo.codigo;
    if (c.cdrCodigo) return `Código ${c.cdrCodigo}`;
    // El rechazo por SOAP Fault no trae CDR, pero sí un código de error.
    if (c.ultimoErrorCodigo) return `Código ${c.ultimoErrorCodigo}`;
    // El fallo de envío ya tiene estado propio: no hace falta descartarlo antes
    // que "Rechazado" porque la ficha no llega aquí con un estado colapsado.
    if (c.estado === 'SIN_CONFIRMAR') return 'Sin confirmar';
    if (c.estado === 'RECHAZADO') return 'Rechazado sin CDR';
    if (c.estado === 'ACEPTADO' || c.estado === 'OBSERVADO') {
      return 'Aceptado sin código';
    }
    // Último recurso: sin CDR, sin código de fault y sin ser un error de red.
    // "Sin respuesta de SUNAT" se leía como si SUNAT fuera a contestar, cuando
    // en realidad el documento nunca le llegó.
    return 'Sin confirmar';
  })();

  /**
   * Hash del CPE tal como lo exige la trama QR: el digest BASE64 de la firma.
   *
   * `c.hashCpe` guarda el SHA-256 HEX del XML (útil para verificar la descarga),
   * pero el campo 10 del QR es el digest BASE64 que produce la firma digital.
   * Ese valor solo existe DENTRO del XML firmado, así que se lee de ahí.
   *
   * MIENTRAS EL XML NO HA LLEGADO `digest` ES `null`, y eso es deliberado: antes
   * se caía a `c.hashCpe` (vacío) y la trama se pintaba terminando en `||`. El
   * usuario veía un QR sin hash durante el segundo que tarda la petición y lo
   * leía como que el arreglo no funcionó. Ahora se pinta un indicador hasta
   * tenerlo, en lugar de una trama incompleta que después cambia.
   */
  const digest = extraerDigestValue(xmlReal ?? null);

  const trama = digest && emisor
    ? generarTramaQrSunat({
        rucEmisor: emisor.ruc,
        tipo: c.tipo,
        serie: c.serie,
        correlativo: c.correlativo,
        igv: c.igv,
        total: c.totalNeto,
        fecha: c.fechaEmision,
        tipoDocCliente: c.clienteTipoDoc,
        numDocCliente: c.clienteRuc,
        hashCpe: digest,
      })
    : null;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>
              {numeroSerie} · {c.clienteRazonSocial}
            </span>
            <InvoiceStatusBadge estado={c.estado} codigo={c.cdrCodigo} resultado={c.resultadoPresentacion} />
          </DialogTitle>
          <PageText variant="caption">
            {/* `null` es DESCONOCIDO, no "Contado": los comprobantes emitidos
                antes de que el backend expusiera la forma de pago no tienen el
                dato, y afirmar "Contado" sería inventar un dato fiscal. */}
            {c.formaPago === 'Credito'
              ? `Crédito (${c.cuotas.length} cuota${c.cuotas.length === 1 ? '' : 's'})`
              : c.formaPago === 'Contado'
                ? 'Contado'
                : 'Forma de pago no registrada'}
            {c.documentoAfectado
              ? ` · Afecta ${c.documentoAfectado}${
                  c.motivoNota
                    ? ` (${c.motivoNota.codigo} - ${c.motivoNota.descripcion})`
                    : ''
                }`
              : ''}
          </PageText>
        </DialogHeader>

        <InvoiceForcedResend key={`forzar-${c.id}`} id={c.id} incierto={c.resultadoPresentacion?.origen === 'TRANSPORTE_INCIERTO' && !['ACEPTADO','OBSERVADO'].includes(c.estado)} />
        {!c.serie.toUpperCase().startsWith('B') && c.resultadoPresentacion?.origen !== 'PREPARACION_LOCAL' && <InvoiceSunatConsulta key={c.id} id={c.id} />}
        <InvoiceBridgeReprocess key={`puente-${c.id}`} id={c.id} estado={c.estado} />

        <Tabs value={modo} onValueChange={(v) => setModo(v as 'cdr' | 'xml')}>
          <TabsList>
            <TabsTrigger value="cdr">Auditoría CDR</TabsTrigger>
            <TabsTrigger value="xml">Visor XML UBL 2.1</TabsTrigger>
          </TabsList>

          <TabsContent value="cdr" className="space-y-4">
            {(c.tipo === '07' || c.tipo === '08') && (c.comprobanteOrigen || c.documentoAfectado) && (() => {
              const orig = (historialCargado?.id === c.id ? historialCargado.comprobanteOrigen : null) ?? c.comprobanteOrigen;
              const tipoOrig = orig?.tipoComprobante === '03' ? 'Boleta (03)' : orig?.tipoComprobante === '01' ? 'Factura (01)' : c.serie.startsWith('B') ? 'Boleta (03)' : 'Factura (01)';
              const numeroOrig = orig?.numero ?? c.documentoAfectado ?? 'No registrado';
              const clienteOrig = orig?.clienteNombre ?? c.clienteRazonSocial;
              const docOrig = orig?.clienteDocumento ?? c.clienteRuc;
              const prefijoMoneda = orig?.moneda === 'USD' ? 'US$' : 'S/';
              const importeOrig = orig?.montoTotal !== null && orig?.montoTotal !== undefined ? `${prefijoMoneda} ${orig.montoTotal.toFixed(2)}` : 'Importe no registrado';
              return (
                <div className="space-y-1 rounded-lg border bg-muted/30 p-3" data-testid="comprobante-origen-modal">
                  <PageText variant="label">Comprobante origen afectado</PageText>
                  <PageText variant="caption">
                    Tipo: {tipoOrig} · Serie y número: {numeroOrig}
                  </PageText>
                  <PageText variant="caption">
                    Cliente: {clienteOrig}{docOrig ? ` (${docOrig})` : ''} · Importe: {importeOrig}
                  </PageText>
                  {c.motivoNota && (
                    <PageText variant="caption">
                      Motivo: {c.motivoNota.codigo} - {c.motivoNota.descripcion}
                    </PageText>
                  )}
                </div>
              );
            })()}
            {/*
              Cronograma del crédito.

              Antes no se pintaba en ninguna parte: el modal recibía
              `formaPago: 'Contado'` y `cuotas: []` fijos para toda fila, así que
              la factura al crédito F001-00000056 —con dos cuotas de 885.00 en su
              XML— se abría como una venta al contado. Se muestran los importes
              tal como viajaron en cada `cac:PaymentTerms`.
            */}
            {c.formaPago === 'Credito' && c.cuotas.length > 0 && (
              <div
                className="space-y-1 rounded-lg border p-3"
                data-testid="cronograma-cuotas"
              >
                <PageText variant="label">Cronograma de pago</PageText>
                {c.cuotas.map((cuota) => (
                  <PageText variant="caption" key={cuota.numero}>
                    {cuota.numero}: S/ {cuota.monto.toFixed(2)} · vence{' '}
                    {cuota.vencimiento}
                  </PageText>
                ))}
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <PageText variant="label">
                {c.estado === 'RECHAZADO' && c.resultadoPresentacion?.origen !== 'SUNAT' ? rechazo?.etiqueta : 'Respuesta oficial CDR SUNAT (billService)'}
              </PageText>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {etiquetaCodigo}
                </Badge>
                <PageText variant="caption">{rechazo?.motivo ?? c.cdrDescripcion}</PageText>
              </div>
              <PageText variant="caption" className="break-all">
                {xmlReal === undefined
                  ? 'digestValue: calculando…'
                  : `digestValue: ${
                      /*
                       * `??` NO basta: el bug que se vio por el túnel. Mientras
                       * el XML viaja, `xmlReal` puede ser ya el texto vacío que
                       * `obtenerXmlDesdeBackend` devuelve cuando el blob no es un
                       * XML válido, y entonces `digest` es `''`. Con `??` la
                       * cadena vacía pasa el filtro (no es null), así que se
                       * pintaba este texto en la primera pintura — mientras la
                       * trama sí se ocultaba bien. La condición tiene que ser
                       * "hay digest no vacío", no "hay digest distinto de null".
                       */
                      digest && digest.trim().length > 0
                        ? digest
                        : 'No disponible: el comprobante aún no tiene el XML firmado'
                    }`}
              </PageText>
              {/*
                La trama solo se pinta cuando el digest está disponible. Con
                `trama === null` no hay nada válido que mostrar: se dice que se
                está calculando, en vez de una trama que termina en `||` y que
                luego cambia al llegar el XML.
              */}
              {trama ? (
                <PageText variant="caption" className="break-all">
                  Trama QR: {trama}
                </PageText>
              ) : (
                /*
                 * El segundo caso NO es "todavía no está firmado": es que el
                 * backend no entregó un XML que se pueda leer (petición fallida,
                 * blob vacío o documento sin firmar). Decirlo así evita afirmar
                 * un estado fiscal que no se comprobó.
                 */
                <PageText variant="caption" className="text-muted-foreground">
                  {xmlReal === undefined
                    ? 'Trama QR: calculando digest del XML firmado…'
                    : 'Trama QR: no disponible — el backend no entregó un XML firmado legible para este comprobante.'}
                </PageText>
              )}
            </div>

            <div className="space-y-1 rounded-lg border p-3">
              <PageText variant="label">Afectación y tributos por línea</PageText>
              {xmlReal && leerTributosXml(xmlReal).length > 0 ? leerTributosXml(xmlReal).map((linea, indice) => (
                <PageText variant="caption" key={`${linea.id ?? 'sin-id'}-${indice}`}>
                  Línea {linea.id ?? 'sin número'}{linea.descripcion ? ` · ${linea.descripcion}` : ''} · Afectación IGV (Catálogo 07): {rotularCodigo(linea.afectacion, NOMBRES_AFECTACION)} · Tributo (Catálogo 05): {rotularCodigo(linea.tributo, NOMBRES_TRIBUTO)}
                </PageText>
              )) : <PageText variant="caption">{xmlReal === undefined ? 'Consultando XML…' : 'Datos de afectación y tributo no disponibles en el XML.'}</PageText>}
            </div>
            {xmlReal && requiereRevisionContableXml(xmlReal) && (
              <PageText variant="caption" className="text-amber-700">Descuento 01/03: el asiento automático utiliza la cuenta 74. Podría quedar pendiente de revisión si la cuenta no está activa en el plan de la empresa o los importes no concuerdan.</PageText>
            )}
            <InvoiceAuditTrail comprobante={c} digest={xmlReal === undefined ? undefined : digest} historial={historialCargado?.id === idComprobante ? historialCargado.eventos : undefined} errorHistorial={historialCargado?.id === idComprobante && historialCargado.error} />
          </TabsContent>

          <TabsContent value="xml">
            {xmlReal === undefined && (
              <PageText variant="caption">Cargando el XML firmado…</PageText>
            )}

            {xmlReal && (
              <>
                <PageText variant="caption" className="mb-2">
                  Documento que produjo el backend y se envió a SUNAT, con su
                  firma digital.
                </PageText>
                <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
                  {xmlReal}
                </pre>
              </>
            )}

            {/* Sin XML guardado se informa; NO se pinta una reconstrucción con
                la forma del documento fiscal, porque se leería como el original
                y podría tener totales distintos. */}
            {xmlReal === null && (
              <PageText variant="caption">
                Este comprobante todavía no tiene el XML firmado guardado en el
                backend. Cuando se procese podrá verse y descargarse aquí.
              </PageText>
            )}
          </TabsContent>
        </Tabs>

        {errorDescarga && (
          <PageText variant="caption" className="text-destructive">
            No se pudo descargar: {errorDescarga}
          </PageText>
        )}

        <DialogFooter>
          {/*
            Se descarga el documento DEL BACKEND, no una reconstrucción local.
            Antes se llamaba a `descargarXmlComprobante(c)`, que armaba el XML en
            el navegador: un archivo con el nombre del comprobante que no era el
            que SUNAT aceptó.
          */}
          <Button
            variant="outline"
            size="sm"
            disabled={descargando !== null}
            onClick={() => descargar('xml')}
          >
            <FileCode2 aria-hidden="true" />
            {descargando === 'xml' ? 'Descargando…' : 'Descargar XML Oficial'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={descargando !== null}
            onClick={() => descargar('pdf')}
          >
            <Download aria-hidden="true" />
            {descargando === 'pdf' ? 'Descargando…' : 'Descargar PDF Homologado'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={descargando !== null || historialCargado?.id !== c.id || !historialCargado.tieneCdr}
            onClick={() => descargar('cdr')}
          >
            <Download aria-hidden="true" />
            {descargando === 'cdr' ? 'Descargando…' : 'Descargar CDR'}
          </Button>
          <Button size="sm" onClick={onCerrar}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

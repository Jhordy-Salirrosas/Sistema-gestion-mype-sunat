import { erroresCamposLinea } from '../lib/invoiceLineFields';
import { agregarFilaModal } from '../lib/invoiceEmptyRow';
import { InvoiceWriteButton } from './InvoiceWriteButton';
import { useInvoiceWritePermission } from '../hooks/useInvoiceWritePermission';
import { problemasContenidoEmision } from '../lib/invoiceEmissionValidation';
import { cantidadBolsasDe } from '../lib/invoiceBags';
import { limitesNota, precargarCantidadesNota } from '../lib/invoiceNoteQuantities';
import { XIcon } from 'lucide-react';
import { problemaSpotMinimo } from '../lib/invoiceDetraccion';
import { useInvoiceKeyboard } from './useInvoiceKeyboard';
/**
 * Modal interactivo de emisión de comprobantes (M1).
 *
 * Captura los datos del CPE —cabecera, grilla de ítems y cronograma de cuotas—,
 * muestra el resumen tributario calculado en tiempo real y, al confirmar,
 * devuelve el comprobante para la grilla. Los campos viven en
 * `InvoiceEmitCampos`, el detalle en `InvoiceItemsGrid` (TA-64), las cuotas en
 * `CreditInstallmentsEditor` y el resumen en `InvoiceEmitResumen`.
 *
 * Cada validación se aplica también en `confirmar` y no solo deshabilitando el
 * botón: el usuario ve el motivo en pantalla y el envío nunca pasa por alto una
 * regla del Catálogo 01/03/06/07/09/10/54.
 */
import { crearIntentoEmision, mensajeErrorEmision } from '../lib/invoiceIdempotency';
import { useEffect, useMemo, useRef, useState } from 'react';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { useQuery } from '@tanstack/react-query';
import { admiteNota, buscarAfectado } from '../lib/invoiceNotaOrigen';
import {
  Button,
  Dialog,
  DialogContent,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PageText,
} from '@/components/ui';
import type { ComprobanteDemo } from '../data/invoiceDemoTypes';
import type { ResultadoEmisionBackend } from '../types/invoiceEmision.types';
import { invoicesApi } from '../services/invoicesApi';
import { enqueueInvoiceEmission } from '@/lib/outbox';
import { borradorAPayloadEmision, problemaDeCronograma } from '../lib/invoiceEmitPayload';
import { problemaDeFechaEmision } from '../lib/invoiceEmitFecha';
import {
  documentoValidoParaTipo,
  mensajeErrorDocumento,
  type TipoEmisible,
} from '../lib/invoiceEmitValidation';
import {
  borradorInicial,
  cambiarFormaPago,
  esTipoNota,
  nuevaClave,
} from '../lib/invoiceEmitDraft';
import type { BorradorEmision } from '../lib/invoiceEmitDraft';
import {
  actualizarItem,
  agregarItem,
  eliminarItem,
  itemDesdeProducto,
  itemVacio,
  type ItemBorrador,
} from '../lib/invoiceItems';
import type { ProductoBuscado } from '../lib/invoiceSearch';
import { tipoComprobantePorPerfil, type PerfilComercial } from '../hooks/useInvoiceConfig';
import { revisarGrilla } from '../lib/invoiceStockLinea';
import {
  buscarDetraccion,
  esDetraccionDadaDeBaja,
  validarCronograma,
} from '../lib/invoiceDetraccion';
import { MedioPagoDetraccionSelect } from './MedioPagoDetraccionSelect';
import { calcularFlujo } from '../lib/invoiceFlujoPago';
export { calcularFlujo } from '../lib/invoiceFlujoPago';
import { InvoiceWarehouseSelect } from './InvoiceWarehouseSelect';
import { cargarProductosAlmacen } from '../services/inventoryProductsApi';
import { InvoiceEmitCampos } from './InvoiceEmitCampos';
import { lineasParaNota } from '../lib/invoiceLineasOrigen';
import { InvoiceEmitResumen } from './InvoiceEmitResumen';
import { RetencionMaestro } from './RetencionMaestro';
import { CreditInstallmentsEditor } from './CreditInstallmentsEditor';
import { problemasDeNota } from '../lib/invoiceNotaOrigen';

interface InvoiceEmitModalProps {
  tipoInicial: TipoEmisible;
  configuracionCargando?: boolean;
  configuracionError?: boolean;
  seriesConfiguradas?: readonly { document_type: string; series: string; is_active: boolean; current_correlative?: number }[];
  fecha: string;
  /** Comprobantes ya emitidos: de aquí salen el correlativo y las notas. */
  existentes: readonly ComprobanteDemo[];
  /**
   * TA-61: productos del almacén para el buscador de la grilla.
   *
   * Llega como prop y no se consulta aquí para que el modal siga siendo
   * montable en una prueba sin backend; quien lo abre decide de dónde salen.
   */
  productos?: readonly ProductoBuscado[];
  /** Precarga de crédito del cliente cuando el modal se abre con cliente ya habilitado. */
  clienteConCredito?: boolean;
  /** Perfil comercial de la empresa (MAYORISTA -> Factura 01, MINORISTA -> Boleta 03). */
  perfilComercial?: PerfilComercial | null;
  /**
   * Se llama con el resultado REAL del backend: número fiscal asignado, importe
   * liquidado y avisos. La emisión ocurre dentro del modal; el padre solo
   * reacciona (recargar la bandeja, mostrar el número).
   */
  onEmitir: (resultado: ResultadoEmisionBackend) => void;
  onCerrar: () => void;
}

/** Motivos por los que todavía no se puede emitir el comprobante. */
const motivosPendientes = (
  b: BorradorEmision,
  existentes: readonly ComprobanteDemo[],
  productos: readonly ProductoBuscado[],
): string[] => {
  const motivos = problemasContenidoEmision({ tipo: b.tipo, clienteRazonSocial: b.clienteRazonSocial, items: b.items, descuentoGlobal: b.descuentoGlobal });

  if (b.serie.length !== 4) motivos.push('La serie debe tener 4 caracteres.');

  // D9: la fecha de emisión es editable, así que puede quedar imposible.
  const problemaFecha = problemaDeFechaEmision(b.fecha);
  if (problemaFecha) motivos.push(problemaFecha);

  if (!documentoValidoParaTipo(b.tipo, b.clienteDoc)) {
    motivos.push(mensajeErrorDocumento(b.tipo));
  }

  /**
   * VALIDACIÓN CONTRA EL STOCK (docente, 31-10).
   *
   *   "la cantidad tiene que ser validada dependiendo de lo que tienes"
   *
   * La pantalla `/invoices/emision` ya lo hacía; el modal NO, aunque recibe
   * los mismos `productos` para el buscador. Ese era el hueco real de la
   * duplicación: quien emitía desde la bandeja podía pedir 500 kg con 20 en
   * almacén, ver el formulario conforme y enterarse del rechazo al enviar.
   *
   * `validarItems` (arriba) NO cubre esto: solo mira descripción, unidad,
   * cantidad positiva y valor unitario. El stock vive en `revisarGrilla`, que
   * suma además las cantidades del MISMO SKU repartidas en varias líneas.
   */
  for (const linea of revisarGrilla(b.items, productos, { nota: esTipoNota(b.tipo) }).lineas) {
    if (linea.gravedad === 'error') {
      motivos.push(`Línea ${linea.indice + 1}: ${linea.mensaje}`);
    }
  }

  const esNota = esTipoNota(b.tipo);
  const { importeTotal, neto, detraccion } = calcularFlujo(b);
  const problemaSpot = problemaSpotMinimo(b.items, b.tipo);
  if (problemaSpot) motivos.push(problemaSpot);
  if (detraccion > 0 && !b.medioPagoDetraccion) motivos.push('Seleccione el medio de pago de la detracción.');

  if (!esNota && b.codigoDetraccion) {
    if (esDetraccionDadaDeBaja(b.codigoDetraccion)) {
      motivos.push(
        `El código de detracción ${b.codigoDetraccion} fue dado de baja por SUNAT.`,
      );
    } else if (!buscarDetraccion(b.codigoDetraccion)) {
      motivos.push(
        `El código de detracción ${b.codigoDetraccion} no existe en el Catálogo 54.`,
      );
    } else if (importeTotal <= 700) {
      motivos.push(
        'La detracción exige un importe mayor a S/ 700.00; este comprobante no la alcanza.',
      );
    }
    if (b.tipo !== '01') {
      motivos.push('La detracción SPOT solo se aplica a Facturas (01).');
    }
  }

  const tieneDescuento =
    Boolean(b.descuentoGlobal) ||
    b.items.some((item) => Boolean(item.descuento));
  if (!esNota && tieneDescuento && b.clienteAdmiteDescuento !== true) {
    motivos.push(
      'El cliente seleccionado no admite descuentos según el maestro de terceros.',
    );
  }

  if (b.formaPago === 'Credito') {
    if (!esNota && b.clienteTieneCredito !== true) {
      motivos.push(
        'La venta al crédito con cuotas solo está habilitada para clientes con crédito registrado en el maestro.',
      );
    }
    // Reglas 3319 y 3267, comprobadas antes de enviar.
    for (const error of validarCronograma(b.cuotas, neto, b.fecha).errores) {
      motivos.push(error);
    }
  }

  if (esNota) {
    // El docente: "es sobre el documento que ya está, no empiezas haciendo una
    // nota de crédito". Antes solo se comprobaba que el texto existiera y que
    // no estuviera rechazado; ahora se revisan además el tipo del documento
    // (no una nota sobre otra nota), el anulado, que sea del MISMO cliente y
    // que la nota no devuelva más de lo que costó la venta.
    for (const problema of problemasDeNota(b, existentes, importeTotal)) {
      motivos.push(problema.mensaje);
    }
  }

  return motivos;
};

/** Modal de emisión con grilla de ítems, cuotas y resumen en tiempo real. */
export const InvoiceEmitModal = ({
  tipoInicial,
  seriesConfiguradas = [],
  configuracionCargando = false,
  configuracionError = false,
  fecha,
  existentes,
  productos: productosIniciales = [],
  clienteConCredito,
  perfilComercial,
  onEmitir,
  onCerrar,
}: InvoiceEmitModalProps) => {
  const formularioRef = useRef<HTMLDivElement>(null);
  const [mostrarErrores, setMostrarErrores] = useState(false);
  const [errorCatalogo, setErrorCatalogo] = useState(false);
  const [catalogoAlmacen, setCatalogoAlmacen] = useState<{ almacen: string; productos: readonly ProductoBuscado[] } | null>(null);
  const puedeOperar = useInvoiceWritePermission();
  const [b, setB] = useState<BorradorEmision>(() => {
    const tipoEfectivo: TipoEmisible =
      tipoInicial === '07' || tipoInicial === '08'
        ? tipoInicial
        : tipoComprobantePorPerfil(perfilComercial) ?? tipoInicial;
    const inicial = borradorInicial(tipoEfectivo, fecha);
    return {
      ...inicial,
      serie: seriesConfiguradas.find(s => s.document_type === tipoEfectivo && s.is_active)?.series ?? '',
      ...(clienteConCredito !== undefined
        ? { clienteTieneCredito: clienteConCredito }
        : {}),
      correlativo: 0,
    };
  });
  const almacen = b.almacen ?? 'ALM-01';
  const productos = useMemo(() => catalogoAlmacen?.almacen === almacen ? catalogoAlmacen.productos : almacen === 'ALM-01' ? productosIniciales : [], [almacen, productosIniciales, catalogoAlmacen]);
  useEffect(() => {
    let vigente = true;
    void cargarProductosAlmacen(almacen, esTipoNota(b.tipo)).then(productos => { if (vigente) { setCatalogoAlmacen({ almacen, productos }); setErrorCatalogo(false); } }).catch(() => { if (vigente) setErrorCatalogo(true); });
    return () => { vigente = false; };
  }, [almacen, b.tipo]);

  /** `true` mientras la emisión viaja al backend; bloquea el doble envío. */
  const intento = useRef(crearIntentoEmision());
  const [enviando, setEnviando] = useState(false);
  /** Motivo por el que el backend rechazó, o por el que no se llegó a enviar. */
  const [errorEmision, setErrorEmision] = useState<string | null>(null);
  const [avisoLineas, setAvisoLineas] = useState('');

  useEffect(() => {
    void Promise.resolve().then(() => setB(previo => {
      const opciones = seriesConfiguradas.filter(s => s.document_type === previo.tipo && s.is_active && (!esTipoNota(previo.tipo) || !previo.documentoAfectado || s.series[0] === previo.documentoAfectado[0])).map(s => s.series);
      const serie = opciones.includes(previo.serie) ? previo.serie : opciones[0] ?? '';
      return serie === previo.serie ? previo : { ...previo, serie };
    }));
  }, [seriesConfiguradas, b.tipo, b.documentoAfectado]);

  const drafts = useRef<Partial<Record<TipoEmisible, BorradorEmision>>>({});
  useEffect(() => { setErrorEmision(null); }, [b]);
  const afectado = buscarAfectado(existentes.filter(admiteNota), b.documentoAfectado);
  const saldoNota = useQuery({
    queryKey: ['invoice-saldo-nota', afectado?.id],
    queryFn: () => invoicesApi.getSaldoNota(afectado!.id),
    enabled: esTipoNota(b.tipo) && !!afectado,
    staleTime: 0,
    retry: false,
  });
  const precargaNota = useRef<{ clave: string; iniciales: BorradorEmision['items']; aplicada: boolean } | null>(null);
  useEffect(() => {
    if (!esTipoNota(b.tipo) || !afectado) { precargaNota.current = null; return; }
    const clave = `${b.tipo}:${afectado.id}`;
    if (precargaNota.current?.clave !== clave) precargaNota.current = { clave, iniciales: b.items, aplicada: false };
    const intentoPrecarga = precargaNota.current;
    if (intentoPrecarga.aplicada) return;
    if (b.items !== intentoPrecarga.iniciales) { intentoPrecarga.aplicada = true; return; }
    if (b.tipo === '07' && (!saldoNota.data || saldoNota.isFetching)) return;
    let vigente = true;
    void Promise.resolve().then(() => invoicesApi.getInvoiceById(afectado.id)).then(detalle => {
      if (!vigente) return;
      const originales = lineasParaNota(detalle.lineasOrigen ?? []);
      intentoPrecarga.aplicada = true;
      if (originales === null) {
        setAvisoLineas('Las líneas del origen contienen datos incompletos o no compatibles; ingréselas manualmente.');
        return;
      }
      const lineas = b.tipo === '07' ? precargarCantidadesNota(originales, saldoNota.data!.cantidades_pendientes, b.motivoCodigo) : originales;
      setAvisoLineas(originales.length > 0 && lineas.length === 0 ? 'No quedan unidades pendientes del comprobante origen.' : '');
      if (originales.length) setB(previo => previo.items === intentoPrecarga.iniciales ? { ...previo, items: lineas } : previo);
    }).catch(() => { if (vigente) { intentoPrecarga.aplicada = true; setAvisoLineas('No se pudieron cargar las líneas del origen; ingréselas manualmente.'); } });
    return () => { vigente = false; };
  }, [afectado, b.tipo, b.items, b.motivoCodigo, saldoNota.data, saldoNota.isFetching]);


  const pendientesBase = useMemo(
    () => motivosPendientes(b, existentes, productos),
    [b, existentes, productos],
  );
  const flujo = calcularFlujo(b);
  const seriesDelTipo = seriesConfiguradas.filter(s => s.document_type === b.tipo && s.is_active).map(s => s.series);
  const pendientes = [...pendientesBase];
  if (!seriesDelTipo.includes(b.serie)) pendientes.push('Configure una serie activa para este tipo de comprobante.');
  if (b.tipo === '07' && afectado) {
    if (!saldoNota.data || saldoNota.isFetching || saldoNota.isError) pendientes.push(saldoNota.isError ? extractApiErrorMessage(saldoNota.error, 'No se pudo consultar el saldo de la nota; inténtelo de nuevo.') : 'Consultando saldo del comprobante…');
    else {
      if (Math.round(flujo.importeTotal * 100) > Math.round(saldoNota.data.disponible * 100)) pendientes.push(`La nota supera el saldo disponible informado por el servidor (S/ ${saldoNota.data.disponible.toFixed(2)}).`);
      pendientes.push(...limitesNota(b.items, saldoNota.data.cantidades_pendientes, b.motivoCodigo, saldoNota.data.motivos_totales).errores);
    }
  }
  const puedeEmitir = pendientes.length === 0;
  const hayErroresCampos = b.items.some(item => Object.values(erroresCamposLinea(item, esTipoNota(b.tipo))).some(Boolean));

  const actualizar = (parcial: Partial<BorradorEmision>) =>
    setB((previo) => {
      if (parcial.tipo && parcial.tipo !== previo.tipo) {
        drafts.current[previo.tipo] = previo;
        const restaurado = drafts.current[parcial.tipo] ?? borradorInicial(parcial.tipo, fecha);
        return { ...restaurado, correlativo: 0 };
      }
      const siguiente = { ...previo, ...parcial };
      if (esTipoNota(siguiente.tipo) && !(siguiente.tipo === '07' && siguiente.motivoCodigo === '13')) { siguiente.formaPago = 'Contado'; siguiente.cuotas = []; }
      if (parcial.codigoDetraccion !== undefined && parcial.codigoDetraccion !== previo.codigoDetraccion) {
        siguiente.items = previo.items.map((item) => ({ ...item, codigoDetraccion: parcial.codigoDetraccion || undefined }));
      }
      if (parcial.documentoAfectado !== undefined && parcial.documentoAfectado !== previo.documentoAfectado) {
        siguiente.items = [itemVacio(nuevaClave())];
      }
      return siguiente;
    });

  const cambiarItem = (indice: number, parcial: Partial<ItemBorrador>) =>
    setB((previo) => ({
      ...previo,
      items: actualizarItem(previo.items, indice, parcial),
    }));

  const quitarItem = (indice: number) =>
    setB((previo) => ({
      ...previo,
      items: eliminarItem(previo.items, indice),
    }));

  const nuevoItem = () => {
    setMostrarErrores(true);
    setB((previo) => ({
      ...previo,
      items: agregarFilaModal(previo.items, () => itemVacio(nuevaClave())),
    }));
    const buscador = formularioRef.current?.querySelector<HTMLInputElement>('[data-invoice-product-search]');
    buscador?.focus();
    buscador?.scrollIntoView?.({ block: 'center' });
  };

  /**
   * Agrega una línea con los datos del producto elegido en el buscador (TA-61).
   *
   * El valor unitario del catálogo se trata como el precio CON IGV incluido
   * cuando el producto lo trae así: es como se rotula en una ferretería
   * ("cemento S/ 32.90"). Si el producto no trae precio, la línea se crea igual
   * con 0 y el usuario lo completa, en lugar de no hacer nada y dejarle la
   * duda de si el clic funcionó.
   */
  const itemDeProducto = (producto: ProductoBuscado) => {
    try {
      const item = itemDesdeProducto(producto, nuevaClave());
      setB(previo => ({ ...previo, items: previo.items.length === 1 && !previo.items[0].codigo.trim() && !previo.items[0].descripcion.trim() ? [item] : agregarItem(previo.items, item) }));
    } catch (error) { setErrorEmision(error instanceof Error ? error.message : 'Producto incompatible'); }
  };

  const nuevaBolsa = (indice: number) => setB(previo => ({
    ...previo, items: actualizarItem(previo.items, indice, {cantidadBolsas: cantidadBolsasDe(previo.items[indice]) + 1}),
  }));

  /**
   * Nombre del comprobante que se va a emitir.
   *
   * El botón decía "Emitir comprobante" aunque el formulario estuviera en modo
   * nota de crédito o de débito: el usuario tecleaba todo, pulsaba, y no había
   * forma de saber qué documento iba a salir hasta verlo en la grilla. El tipo
   * ya está elegido arriba, así que se nombra.
   */
  const nombreDocumento =
    b.tipo === '07'
      ? 'Nota de Crédito'
      : b.tipo === '08'
        ? 'Nota de Débito'
        : b.tipo === '03'
          ? 'Boleta'
          : 'Factura';

  /**
   * Emite contra el backend.
   *
   * ANTES ESTO NO EMITÍA NADA. El botón llamaba a `onEmitir`, que en
   * `InvoicesListPage` solo cerraba el diálogo y recargaba la grilla: el usuario
   * veía desaparecer el formulario y creía haber emitido, mientras el servidor
   * no recibía ninguna petición. La emisión real la hacía únicamente la página
   * `/invoices/emision`, con su propio payload escrito a mano.
   *
   * Ahora el payload sale de `borradorAPayloadEmision` (el mismo traductor que
   * usa la página) y se envía de verdad.
   */
  const confirmar = async () => {
    if (!puedeOperar) return;
    setMostrarErrores(true);
    const primerCampo = formularioRef.current?.querySelector<HTMLInputElement>('[data-line-invalid="true"]');
    if (primerCampo) { primerCampo.focus(); primerCampo.scrollIntoView?.({ block: 'center' }); return; }
    if (!puedeEmitir || enviando) return;

    const problema = problemaDeCronograma(b);
    if (problema) {
      setErrorEmision(problema);
      return;
    }

    setEnviando(true);
    setErrorEmision(null);
    const payload = borradorAPayloadEmision(b);
    const clave = intento.current.clavePara(payload);
    try {
      if (b.tipo === '07' && afectado) {
        const actual = await invoicesApi.getSaldoNota(afectado.id);
        const errorCantidad = limitesNota(b.items, actual.cantidades_pendientes, b.motivoCodigo, actual.motivos_totales).errores[0];
        if (errorCantidad) throw new Error(errorCantidad);
        if (Math.round(flujo.importeTotal * 100) > Math.round(actual.disponible * 100)) throw new Error('La nota supera el saldo actualizado del comprobante.');
      }
      const resultado = await invoicesApi.emitirComprobante(
        payload,
        clave,
      );
      intento.current.completar();
      onEmitir(resultado);
    } catch (error: unknown) {
      const sinRespuesta =
        !(error as { response?: unknown })?.response &&
        (!navigator.onLine || (error instanceof Error && 'response' in error));
      if (sinRespuesta) {
        await enqueueInvoiceEmission(payload, clave);
        onEmitir(null as never);
        return;
      }
      // NO se inventa un número ni un CDR: se muestra lo que dijo el backend.
      const mensaje =
        mensajeErrorEmision(error);
      setErrorEmision(`No se pudo emitir el comprobante: ${mensaje}`);
    } finally {
      setEnviando(false);
    }
  };

  const teclado = useInvoiceKeyboard(nuevoItem, () => { void confirmar(); }, enviando || !puedeOperar);
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent ref={formularioRef} showCloseButton={false} onKeyDown={teclado.handler} onEscapeKeyDown={e => e.preventDefault()} className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Emitir Comprobante Electrónico</DialogTitle>
          {teclado.ayuda}
          <PageText variant="caption">
            Los montos se calculan con el motor tributario UBL 2.1 del módulo.
            El comprobante entra a la cola Outbox y sale con el CDR de SUNAT.
          </PageText>
        </DialogHeader>

        {avisoLineas && <p role="status">{avisoLineas}</p>}
        <InvoiceWarehouseSelect value={b.almacen ?? 'ALM-01'} onChange={codigo => {
          setB(prev => ({ ...prev, almacen: codigo }));
        }} />
        <InvoiceEmitCampos mostrarErrores={mostrarErrores}
          borrador={b}
          configuracionCargando={configuracionCargando}
          configuracionError={configuracionError}
          series={seriesDelTipo}
          correlativoActual={seriesConfiguradas.find(s => s.document_type === b.tipo && s.series === b.serie && s.is_active)?.current_correlative}
          actualizar={actualizar}
          existentes={existentes}
          total={flujo.importeTotal}
          saldoNota={esTipoNota(b.tipo) ? saldoNota.data : undefined}
          onItemCambiado={cambiarItem}
          onItemEliminado={quitarItem}
          onItemAgregado={nuevoItem}
          onBolsaAgregada={nuevaBolsa}
          catalogoEstado={errorCatalogo ? 'error' : catalogoAlmacen?.almacen === almacen ? 'listo' : 'cargando'}
          productos={productos}
          onItemDesdeProducto={itemDeProducto}
        />

        <div className="flex flex-wrap items-center gap-2">
          <PageText variant="label">Forma de pago</PageText>
          {(['Contado', 'Credito'] as const).map((forma) => {
            const creditoHabilitado =
              (b.tipo === '07' && b.motivoCodigo === '13') || (b.tipo === '01' && b.clienteTieneCredito === true);
            return (
              <Button
                key={forma}
                type="button"
                disabled={forma === 'Credito' && !creditoHabilitado}
                variant={b.formaPago === forma ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (forma === 'Credito' && !creditoHabilitado) return;
                  setB((previo) =>
                    cambiarFormaPago(previo, forma, flujo.neto),
                  );
                }}
              >
                {forma === 'Credito' ? 'Crédito' : 'Contado'}
              </Button>
            );
          })}
          {!esTipoNota(b.tipo) && b.clienteTieneCredito !== true && (
            <PageText variant="caption">
              La venta al crédito con cuotas solo se habilita para clientes con
              crédito registrado en el maestro.
            </PageText>
          )}
        </div>

        {b.formaPago === 'Credito' && (
          <CreditInstallmentsEditor
            cuotas={b.cuotas}
            netoPendiente={flujo.neto}
            fechaEmision={b.fecha}
            onCambiar={(cuotas) => setB((previo) => ({ ...previo, cuotas }))}
          />
        )}

        <RetencionMaestro documento={b.clienteDoc} razonSocial={b.clienteRazonSocial} valor={b.agenteRetencion}
          disabled={esTipoNota(b.tipo)} onChange={(agenteRetencion, correccionRetencion) => actualizar({ agenteRetencion, correccionRetencion })} />

        <MedioPagoDetraccionSelect aplica={flujo.detraccion > 0} value={b.medioPagoDetraccion}
          onChange={(medioPagoDetraccion) => actualizar({ medioPagoDetraccion })} />
        <InvoiceEmitResumen borrador={b} />

        {pendientes.length > 0 && (
          <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <PageText variant="label">Falta completar</PageText>
            {pendientes.map((motivo) => (
              <PageText key={motivo} variant="caption">
                · {motivo}
              </PageText>
            ))}
          </div>
        )}

        {/* El rechazo del backend se muestra aquí, no se pierde al cerrar el
            modal: si el servidor dice que falta stock o que el RUC no cuadra,
            el usuario tiene que poder leerlo y corregir. */}
        {errorEmision && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <PageText variant="label" className="text-destructive">
              No se emitió
            </PageText>
            <PageText variant="caption">{errorEmision}</PageText>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <InvoiceWriteButton size="sm" onClick={confirmar} disabled={enviando || (!puedeEmitir && !hayErroresCampos)}>
            {enviando ? 'Emitiendo…' : `Emitir ${nombreDocumento}`}
          </InvoiceWriteButton>
        </DialogFooter>
        <DialogClose asChild><Button type="button" variant="ghost" size="icon-sm" className="absolute top-2 right-2" aria-label="Cerrar"><XIcon aria-hidden="true" /><span className="sr-only">Cerrar</span></Button></DialogClose>
      </DialogContent>
    </Dialog>
  );
};

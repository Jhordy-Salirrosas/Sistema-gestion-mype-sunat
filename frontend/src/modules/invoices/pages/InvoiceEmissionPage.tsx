import { useInvoiceNoteEmission } from '../hooks/useInvoiceNoteEmission';
import { InvoiceNoteFields } from '../components/InvoiceNoteFields';
import { borradorInicial, esTipoNota } from '../lib/invoiceEmitDraft';
import { limitesNota } from '../lib/invoiceNoteQuantities';
import type { TipoEmisible } from '../lib/invoiceEmitValidation';
import '../components/invoiceIntegratedFields.css';
import { useInvoiceBlur } from '../hooks/useInvoiceBlur';
import { flushSync } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { masterDataApi } from '@/modules/customs/services/masterDataApi';
import { invoiceFormIssues } from '../lib/invoiceFormIssues';
import { InlineInvoiceError, InvoiceErrorSummary } from '../components/InvoiceFormFeedback';
import { InvoiceReview } from '../components/InvoiceReview';
import { useInvoiceLocalDraft } from '../hooks/useInvoiceLocalDraft';
import { InvoiceUxPage as Page } from '../components/InvoiceUxPage';
import { InvoicePaymentPanel } from '../components/InvoicePaymentPanel';
import { useCommercialDefaults, permittedDefault } from '../hooks/useCommercialDefaults';
import { useInvoiceDatePermission } from '../hooks/useInvoiceDatePermission';
import { enfocarBusquedaProducto, colocarProductoEnFilaVacia } from '../lib/invoiceEmptyRow';
import { igvReferencialGratuito } from '../lib/invoiceIgvReferencial';
import { useInvoiceWritePermission } from '../hooks/useInvoiceWritePermission';
import { InvoiceWriteButton } from '../components/InvoiceWriteButton';
import { problemasContenidoEmision } from '../lib/invoiceEmissionValidation';
import { cantidadBolsasDe } from '../lib/invoiceBags';
import { editarIdentidadCliente } from '../lib/invoiceCustomerIdentity';
import { InvoiceNextNumber } from '../components/InvoiceNextNumber';
import { pagoSegunDeposito } from '../lib/invoicePagoPresentacion';
import { problemaSpotMinimo } from '../lib/invoiceDetraccion';
import { useInvoiceKeyboard } from '../components/useInvoiceKeyboard';
/**
 * Emisión de comprobantes electrónicos (M1).
 *
 * QUÉ SE CORRIGIÓ AQUÍ Y POR QUÉ
 *
 * Revisión del docente (31-10):
 *
 * 1. **Inventaba el CDR.** Si el `fetch` fallaba, el `catch` pintaba un verde
 *    "ACEPTADO - CDR SUNAT Simulado". Una constancia de recepción la emite SUNAT
 *    o no existe. Ahora, si la petición falla, se muestra el error y el
 *    comprobante NO queda aceptado.
 *
 * 2. **Un ítem por comprobante.** "No vas a colocar una factura por producto".
 *    La grilla admite varias líneas, cada una con su afectación de IGV y su
 *    detracción.
 *
 * 3. **El cliente "que no lo escriba, que lo busque".** El campo usa el buscador
 *    de la cartera y permite registrar uno nuevo cuando no existe.
 *
 * 4. **"Supone que esos productos los tienes en tu inventario, ¿por qué tendría
 *    que escribirlos?"** El buscador de productos trae SKU, descripción y
 *    precio del almacén.
 *
 * 5. **"La cantidad tiene que ser validada dependiendo de lo que tienes."** El
 *    stock se conoce al elegir el producto y la grilla avisa cuando se pide más
 *    de lo disponible; el backend lo vuelve a validar antes de reservar el
 *    correlativo.
 *
 * COMPROBADO CONTRA EL SERVIDOR REAL
 *
 * Hasta hoy esta pantalla mandaba el formulario a `POST /invoices`, que exige el
 * contrato fiscal completo (`payload_ubl`, `correlativo`...). El backend
 * respondía 400 `property clienteRuc should not exist` a TODAS las emisiones:
 * la pantalla nunca pudo emitir nada. Ahora usa `POST /invoices/emitir`, que
 * acepta la forma del formulario y devuelve el número real.
 *
 * LO QUE ESTA PANTALLA NO DICE
 *
 * El número que se muestra es el que asignó la serie, y el estado es PENDIENTE.
 * El CDR se consulta en la bandeja. No se muestra "ACEPTADO" en ningún caso
 * aquí, porque SUNAT no ha respondido todavía.
 */
import { crearIntentoEmision, mensajeErrorEmision } from '../lib/invoiceIdempotency';
import { MedioPagoDetraccionSelect } from '../components/MedioPagoDetraccionSelect';
import type { MedioPagoDetraccion } from '../lib/medioPagoDetraccion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  PageText,
} from '@/components/ui';
import { FileText, Send } from 'lucide-react';
import { documentoValidoParaTipo, mensajeErrorDocumento } from '../lib/invoiceEmitValidation';
import { useRucAutofill } from '../hooks/useRucAutofill';
import { CustomerLookupField, partnerToCustomer } from '../components/CustomerLookupField';
import { InvoiceItemsGrid } from '../components/InvoiceItemsGrid';
import { InvoiceDescuentoGlobal } from '../components/InvoiceDescuentoGlobal';
import { liquidarDescuentoGlobal, type DescuentoGlobal } from '../lib/invoiceDescuentoGlobal';
import { detraccionConDescuento } from '../lib/invoiceDetraccionGlobal';
import { CreditInstallmentsEditor } from '../components/CreditInstallmentsEditor';
import {
  actualizarItem,
  calcularItem,
  itemDesdeProducto,
  type ItemBorrador,
} from '../lib/invoiceItems';
import {
  repartirPago,
} from '../lib/invoiceDetraccionLinea';
import {
  repartirEnCuotas,
  validarCronograma,
  type CuotaBorrador,
} from '../lib/invoiceDetraccion';
import { cambiarFechaEmision } from '../lib/invoiceEmitDraft';
import type { BorradorEmision } from '../lib/invoiceEmitDraft';
import { borradorAPayloadEmision } from '../lib/invoiceEmitPayload';
import {
  minimoDeFechaEmision,
  problemaDeFechaEmision,
  topeDeFechaEmision,
} from '../lib/invoiceEmitFecha';
import { hoyEnLima } from '../lib/invoiceFecha';
import { calcularRetencion, roundDetraccion } from '../lib/invoiceRetentions';
import { RetencionMaestro } from '../components/RetencionMaestro';
import { invoicesApi } from '../services/invoicesApi';
import { apiClient } from '@/lib/axios';
import { tipoComprobantePorPerfil, type ConfiguracionBackend } from '../hooks/useInvoiceConfig';
import { enqueueInvoiceEmission } from '@/lib/outbox';
import { InvoiceWarehouseSelect } from '../components/InvoiceWarehouseSelect';
import { cargarProductosAlmacen } from '../services/inventoryProductsApi';
import { revisarGrilla, primeraLineaConError } from '../lib/invoiceStockLinea';
import type { ProductoBuscado } from '../lib/invoiceSearch';
import type { ResultadoEmisionBackend } from '../types/invoiceEmision.types';


/*
 * Aquí vivía `CODIGO_AFECTACION`, la traducción de 'GRAVADA' al código 10 del
 * Catálogo 07. Se RETIRÓ al unificar: `borradorAPayloadEmision` hace esa misma
 * traducción desde su propio `CODIGO_AFECTACION`, y tener las dos era
 * precisamente el riesgo de que una línea exonerada saliera gravada por
 * arreglar solo uno de los dos mapas.
 */

export default function InvoiceEmissionPage() {
  const puedeOperar = useInvoiceWritePermission();
  const queryClient = useQueryClient();
  const usuario = useAuthStore(state=>state.user?.id);
  const empresa = useAuthStore(state=>state.activeCompany?.tenantId);
  const restaurando = useRef(false);
  const { canEditDate, explanation: dateExplanation } = useInvoiceDatePermission();
  const [searchParams] = useSearchParams();
  const tipoQuery = searchParams.get('tipo');
  const [tipo, setTipo] = useState<TipoEmisible>(
    tipoQuery === '03' || tipoQuery === '07' || tipoQuery === '08' ? tipoQuery : '01',
  );

  const esNota = esTipoNota(tipo);
  const [nota, setNota] = useState(() => { const b = borradorInicial(tipo, ''); return { documentoAfectado: b.documentoAfectado, tipoDocumentoAfectado: b.tipoDocumentoAfectado, motivoCodigo: b.motivoCodigo, motivoDescripcion: b.motivoDescripcion }; });
  const [preservarItemsNota, setPreservarItemsNota] = useState(false);

  const [seriesConfiguradas, setSeriesConfiguradas] = useState<NonNullable<ConfiguracionBackend['series']>>([]);
  const [estadoConfiguracion, setEstadoConfiguracion] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [serieElegida, setSerieElegida] = useState('');
  const seriesDelTipo = seriesConfiguradas.filter(s => s.document_type === tipo && s.is_active && (!esNota || !nota.documentoAfectado || s.series[0] === nota.documentoAfectado[0]));
  const serieActual = seriesDelTipo.find(s => s.series === serieElegida)?.series ?? seriesDelTipo[0]?.series ?? '';
  useEffect(() => {
    let vivo = true;
    apiClient
      .get<ConfiguracionBackend>('/invoices/config')
      .then(({ data }) => {
        if (!vivo) return;
        const sugerido = tipoComprobantePorPerfil(data?.perfil_comercial);
        setSeriesConfiguradas(data.series ?? []);
        setEstadoConfiguracion('listo');
        if (sugerido && !['01','03','07','08'].includes(tipoQuery ?? '')) setTipo(sugerido);
      })
      .catch(() => { if (vivo) setEstadoConfiguracion('error'); });
    return () => {
      vivo = false;
    };
  }, [tipoQuery]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<import('../lib/invoiceSearch').ClienteBuscado | null>(null);
  const [clienteDoc, setClienteDoc] = useState('');
  const [clienteRazonSocial, setClienteRazonSocial] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const rucAutofill = useRucAutofill((datos) => {
    setClienteRazonSocial(datos.razonSocial);
    setClienteDireccion(datos.direccionFiscal ?? '');
  });
  const [items, setItems] = useState<readonly ItemBorrador[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState<DescuentoGlobal | null>(null);
  const [agenteRetencion, setAgenteRetencion] = useState(false);
  const [correccionRetencion, setCorreccionRetencion] = useState(false);
  // Forma de pago y cronograma (HU-10). Antes la pantalla mandaba siempre
  // 'Contado'; el selector vivía solo en el modal de la bandeja. Las funciones
  // que reparten las cuotas ya existían y estaban probadas en
  // `invoiceEmitDraft`, así que aquí solo se guarda el estado.
  const { data: commercialDefaults, isError: defaultsError } = useCommercialDefaults();
  const [formaPago, setFormaPago] = useState<'Contado' | 'Credito'>('Contado');
  useEffect(() => {
    if (esTipoNota(tipo)) { restaurando.current = false; return; }
    if (restaurando.current) { restaurando.current=false; return; }
    if (commercialDefaults) { setFormaPago(permittedDefault(commercialDefaults, clienteSeleccionado?.tieneCredito === true, tipo)); setMedioPago(commercialDefaults.medio_pago); setCuotas([]); }
  }, [commercialDefaults, clienteSeleccionado?.id, clienteSeleccionado?.tieneCredito, tipo]);
  const [medioPago, setMedioPago] = useState<import('../types/invoiceEmision.types').MedioPagoVenta>('EFECTIVO');
  const [cuotas, setCuotas] = useState<readonly CuotaBorrador[]>([]);
  const intento = useRef(crearIntentoEmision());
  const [enviando, setEnviando] = useState(false);
  const [catalogoEstado, setCatalogoEstado] = useState<'listo' | 'cargando' | 'error'>('cargando');
  const formRef = useRef<HTMLFormElement>(null);
  const [almacen, setAlmacen] = useState('ALM-01');
  const [productos, setProductos] = useState<readonly ProductoBuscado[]>([]);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    mensaje: string;
    numero?: string;
    avisos?: readonly string[];
  } | null>(null);

  // Productos del almacén para el buscador: el docente fue explícito en que el
  // producto sale del inventario, no del teclado. Si la carga falla, la lista
  // queda vacía y la grilla sigue admitiendo líneas escritas a mano.
  useEffect(() => {
    let vivo = true;
    (esNota ? cargarProductosAlmacen(almacen, true) : cargarProductosAlmacen(almacen)).then((lista) => {
      if (vivo) { setProductos(lista); setCatalogoEstado('listo'); }
    }).catch(() => { if (vivo) setCatalogoEstado('error'); });
    return () => {
      vivo = false;
    };
  }, [almacen, esNota]);

  // Liquidación real línea por línea: cada línea aporta según su afectación y
  // las gratuitas no cobran. No hay un 18 % sobre el total.
  const totales = useMemo(() => liquidarDescuentoGlobal(items, descuentoGlobal), [items, descuentoGlobal]);

  /**
   * Desglose por afectación del Catálogo 07.
   *
   * `TotalesGrilla` solo trae base, IGV y total; la pantalla necesita ver cuánto
   * de la venta es gravada, exonerada e inafecta —SUNAT las pide separadas en el
   * XML— así que se agregan aquí sin tocar el modelo.
   */
  const porAfectacion = useMemo(() => {
    const acumulado = { GRAVADA: 0, EXONERADA: 0, INAFECTA: 0, GRATUITA: 0 };
    for (const item of items) {
      acumulado[item.afectacion] += calcularItem(item).base;
    }
    acumulado.GRAVADA = totales.gravado;
    return acumulado;
  }, [items, totales.gravado]);

  const [medioPagoDetraccion, setMedioPagoDetraccion] = useState<MedioPagoDetraccion | ''>('');
  const importeTotal = totales.total;
  const igvReferencial = igvReferencialGratuito(items);

  // Detracción por LÍNEA: "los productos son con detracción, no la factura".
  const detraccion = useMemo(
    () => esNota ? detraccionConDescuento([], null) : detraccionConDescuento(items, descuentoGlobal),
    [items, descuentoGlobal, esNota],
  );

  // Retención del IGV: es del CLIENTE, no del comprobante.
  const retencion = useMemo(
    () => calcularRetencion(importeTotal, !esNota && agenteRetencion, 1, detraccion.monto, totales.gravado),
    [importeTotal, agenteRetencion, detraccion.monto, totales.gravado, esNota],
  );

  const reparto = useMemo(
    () => repartirPago(importeTotal, detraccion.monto, retencion),
    [importeTotal, detraccion.monto, retencion],
  );

  /**
   * Neto que se reparte en cuotas: el pago directo, es decir el importe total
   * menos la detracción (que va al Banco de la Nación) y menos la retención
   * (que retiene el cliente). Las cuotas deben sumar exactamente esto por la
   * regla 3319, sin tolerancia.
   */
  const netoPendiente = useMemo(
    () => Math.round(Math.max(0, reparto.pagoDirecto) * 100) / 100,
    [reparto.pagoDirecto],
  );

  /**
   * Fecha de emisión en Lima (D9). Se precarga con HOY y es editable.
   *
   * Es la base de los vencimientos de las cuotas (regla 3267), así que al
   * cambiarla hay que re-derivar el cronograma: se hace con
   * `cambiarFechaEmision`, que conserva el plazo de cada cuota respecto de la
   * emisión anterior. Se calcula en el inicializador del `useState` y no en el
   * cuerpo porque la regla `react-hooks/purity` prohíbe `Date.now()` durante el
   * render.
   */
  const [fechaEmision, setFechaEmision] = useState(hoyEnLima);
  useEffect(() => {
    setResultado((previo) => previo?.ok === false ? null : previo);
  }, [tipo, clienteSeleccionado, clienteDoc, clienteRazonSocial, clienteDireccion, items, descuentoGlobal, agenteRetencion, correccionRetencion, formaPago, cuotas, medioPagoDetraccion, fechaEmision]);

  /** Motivo por el que la fecha de emisión no sirve, o `null` (D9). */
  const problemaFecha = problemaDeFechaEmision(fechaEmision, undefined, tipo);

  /**
   * Cambia la fecha y arrastra el cronograma.
   *
   * Se trabaja sobre un borrador mínimo en lugar de sobre el estado de la
   * página porque esta pantalla guarda los campos en `useState` sueltos y la
   * re-derivación de plazos vive una sola vez, en `invoiceEmitDraft`.
   */
  const cambiarFecha = (nueva: string) => {
    // `cambiarFechaEmision` solo lee `fecha` y `cuotas` del borrador, así que un
    // objeto mínimo basta: esta pantalla guarda los campos sueltos y no monta un
    // `BorradorEmision` completo.
    const previo = { fecha: fechaEmision, cuotas } as BorradorEmision;
    setFechaEmision(nueva);
    setCuotas(cambiarFechaEmision(previo, nueva).cuotas);
  };


  const agregarItem = () => {
    enfocarBusquedaProducto(formRef.current);
  };

  /**
   * Edita una línea con `actualizarItem`, el helper COMPARTIDO.
   *
   * Antes esta página tenía su propia versión —`{ ...item, ...parcial }` a
   * pelo— que duplicaba la del modal y no aplicaba `sincronizarIcbper`. Por eso
   * la bolsa plástica de ESTA pantalla se quedaba en S/ 0,50 al pasar la
   * cantidad a 2, mientras la del modal se actualizaba a S/ 1,00: el mismo
   * gesto daba resultados distintos según por dónde se entrara.
   *
   * Es el mismo tipo de duplicación que se eliminó del payload: mientras cada
   * formulario tenga su copia de una regla, un arreglo en una no llega a la otra.
   */
  const cambiarItem = (indice: number, parcial: Partial<ItemBorrador>) => {
    setItems((prev) => actualizarItem(prev, indice, parcial));
  };

  const [ultimaLineaQuitada,setUltimaLineaQuitada]=useState<{indice:number;item:ItemBorrador}|null>(null);
  const eliminarItem = (indice: number) => {
    if(items[indice])setUltimaLineaQuitada({indice,item:items[indice]});
    setItems((prev) => prev.filter((_, i) => i !== indice));
  };

  /**
   * Coloca el producto elegido en la grilla.
   *
   * SI HAY UNA LÍNEA VACÍA SE RELLENA, no se añade otra: la grilla nace con una
   * fila vacía y añadir siempre dejaba esa fila arriba, de modo que quien
   * editaba "la fila 1" cambiaba la vacía y el comprobante salía sin eso.
   *
   * La línea se arma con `itemDesdeProducto`, que COMPRUEBA la unidad contra el
   * Catálogo 03 (el almacén puede devolver "kg" o "NIU " y eso haría un XML
   * rechazado). Antes esta página construía el objeto a mano y se saltaba esa
   * comprobación; es exactamente la duplicación que se elimina al unificar.
   */
  const agregarConProducto = (producto: ProductoBuscado) => {
    let relleno: ItemBorrador;
    try { relleno = itemDesdeProducto(producto, 'prod'); }
    catch (error) { setResultado({ ok: false, mensaje: error instanceof Error ? error.message : 'Producto incompatible' }); return; }

    setItems(prev => colocarProductoEnFilaVacia(prev, { ...relleno, clave: String(Date.now()) }));
  };

  const borradorCompleto: BorradorEmision = {
    almacen,
    tipo,
    serie: serieActual,
    correlativo: 0, // lo asigna la serie en el backend
    clienteId: clienteSeleccionado?.id,
    clienteTieneCredito: clienteSeleccionado?.tieneCredito,
    clienteAdmiteDescuento: clienteSeleccionado?.admiteDescuento,
    clienteTipoDocumento: clienteSeleccionado?.tipoDocumento,
    clienteDireccion,
    clienteDoc,
    clienteTipoDoc: tipo === '01' ? '6' : '1',
    clienteRazonSocial,
    items,
    descuentoGlobal,
    formaPago,
    medioPago,
    cuotas,
    numeroCuotas: cuotas.length || 2,
    codigoDetraccion: '',
    medioPagoDetraccion,
    agenteRetencion,
    correccionRetencion,
    bolsas: 0,
    ...nota,
    fecha: fechaEmision,
  };
  const notaEmision = useInvoiceNoteEmission(borradorCompleto, setItems, preservarItemsNota);
  const actualizarNota = (parcial: Partial<BorradorEmision>) => {
    const cambiaOrigen = parcial.documentoAfectado !== undefined && parcial.documentoAfectado !== nota.documentoAfectado;
    setNota(prev => ({ ...prev,
      ...(parcial.documentoAfectado !== undefined ? { documentoAfectado: parcial.documentoAfectado } : {}),
      ...(parcial.tipoDocumentoAfectado !== undefined ? { tipoDocumentoAfectado: parcial.tipoDocumentoAfectado } : {}),
      ...(parcial.motivoCodigo !== undefined ? { motivoCodigo: parcial.motivoCodigo } : {}),
      ...(parcial.motivoDescripcion !== undefined ? { motivoDescripcion: parcial.motivoDescripcion } : {}),
    }));
    if (parcial.serie !== undefined) setSerieElegida(parcial.serie);
    if (parcial.clienteDoc !== undefined) { rucAutofill.cancelar(); setClienteDoc(parcial.clienteDoc); setClienteSeleccionado(null); setClienteDireccion(parcial.clienteDireccion ?? ''); }
    if (parcial.clienteRazonSocial !== undefined) setClienteRazonSocial(parcial.clienteRazonSocial);
    if (parcial.fecha !== undefined) setFechaEmision(parcial.fecha);
    if (parcial.formaPago !== undefined) setFormaPago(parcial.formaPago);
    if (parcial.cuotas !== undefined) setCuotas(parcial.cuotas);
    if (cambiaOrigen) { setItems([]); setPreservarItemsNota(false); }
    else if (parcial.items !== undefined) setItems(parcial.items);
    if ('descuentoGlobal' in parcial) setDescuentoGlobal(parcial.descuentoGlobal ?? null);
  };
  const cambiarTipoEmision = (siguiente: TipoEmisible) => {
    if (esTipoNota(siguiente) || esNota) {
      const inicial = borradorInicial(siguiente, fechaEmision);
      setNota({ documentoAfectado: '', tipoDocumentoAfectado: inicial.tipoDocumentoAfectado, motivoCodigo: inicial.motivoCodigo, motivoDescripcion: inicial.motivoDescripcion });
      setPreservarItemsNota(false); setItems([]); setClienteSeleccionado(null); setClienteDoc(''); setClienteRazonSocial(''); setClienteDireccion(''); setDescuentoGlobal(null); setAgenteRetencion(false); setCorreccionRetencion(false); setFormaPago('Contado'); setCuotas([]); setSerieElegida('');
    }
    setTipo(siguiente);
    if (siguiente === '03') { setFormaPago('Contado'); setCuotas([]); }
    setResultado(null);
  };
  const incidencias = [...invoiceFormIssues({tipo,serie:serieActual,fecha:fechaEmision,documento:clienteDoc,nombre:clienteRazonSocial,items,descuento:descuentoGlobal,productos,detraccion:detraccion.aplica,medioDetraccion:medioPagoDetraccion,forma:formaPago,cuotas,neto:netoPendiente}), ...notaEmision.pendientes];
  const feedback = useInvoiceBlur(incidencias);
  const resumenErroresRef = useRef<HTMLDivElement>(null);
  const [revisar,setRevisar] = useState(false);
  const revisionConfirmada = useRef(false);
  const snapshot = {tipo,serie:serieActual,fecha:fechaEmision,almacen,clienteDoc,clienteRazonSocial,clienteDireccion,clienteSeleccionado,items,descuentoGlobal,formaPago,medioPago,cuotas,agenteRetencion,correccionRetencion,medioPagoDetraccion,nota};
  const borradorLocal = useInvoiceLocalDraft(usuario&&empresa?`m1:emision:v1:${empresa}:${usuario}`:null,snapshot);
  const [errorBorrador,setErrorBorrador] = useState('');
  const retomar = async () => {
    const d = borradorLocal.disponible?.data;
    if(!d)return;
    if(!['01','03','07','08'].includes(d.tipo)||(esTipoNota(d.tipo)&&(!d.nota||![d.nota.documentoAfectado,d.nota.tipoDocumentoAfectado,d.nota.motivoCodigo,d.nota.motivoDescripcion].every(v=>typeof v==='string')))||![d.serie,d.fecha,d.almacen,d.clienteDoc,d.clienteRazonSocial,d.clienteDireccion].every(v=>typeof v==='string')||!['Contado','Credito'].includes(d.formaPago)||!['EFECTIVO','YAPE','PLIN','TARJETA','TRANSFERENCIA','DEPOSITO','CHEQUE'].includes(d.medioPago)||!Array.isArray(d.cuotas)||!d.cuotas.every(c=>c&&Number.isFinite(c.monto)&&typeof c.vencimiento==='string')||!Array.isArray(d.items)||!d.items.every(i=>i&&['clave','codigo','descripcion','unidad'].every(k=>typeof i[k as keyof typeof i]==='string')&&Number.isFinite(i.cantidad)&&Number.isFinite(i.valorUnitario)&&['GRAVADA','GRATUITA','EXONERADA','INAFECTA'].includes(i.afectacion))) {setErrorBorrador('El borrador local no se puede recuperar. Descártelo para continuar.');return;}
    try {
      // La condición comercial se vuelve a leer del maestro; no se confía en una copia local.
      const cliente = d.clienteSeleccionado?.id ? partnerToCustomer(await masterDataApi.getPartner(d.clienteSeleccionado.id)) : null;
      restaurando.current = Boolean(commercialDefaults) && (tipo!==d.tipo||clienteSeleccionado?.id!==cliente?.id||clienteSeleccionado?.tieneCredito!==cliente?.tieneCredito);
      flushSync(()=>{setTipo(d.tipo);setClienteSeleccionado(cliente);});
      setNota(d.nota ?? { documentoAfectado: '', tipoDocumentoAfectado: '0101', motivoCodigo: '01', motivoDescripcion: '' }); setPreservarItemsNota(esTipoNota(d.tipo));
      setSerieElegida(d.serie);setFechaEmision(d.fecha);setAlmacen(d.almacen);
      setClienteDoc(cliente?.numeroDocumento??d.clienteDoc);setClienteRazonSocial(cliente?.razonSocial??d.clienteRazonSocial);setClienteDireccion(cliente?.direccion??d.clienteDireccion);
      const credito = (d.tipo==='07'&&d.nota?.motivoCodigo==='13')||(d.tipo==='01'&&cliente?.tieneCredito===true);
      setItems(esTipoNota(d.tipo)||cliente?.admiteDescuento===true?d.items:d.items.map(i=>({...i,descuento:null})));setDescuentoGlobal(esTipoNota(d.tipo)||cliente?.admiteDescuento===true?d.descuentoGlobal:null);setFormaPago(d.formaPago==='Credito'&&!credito?'Contado':d.formaPago);setMedioPago(d.medioPago);setCuotas(d.formaPago==='Credito'&&credito?d.cuotas:[]);
      setAgenteRetencion(d.agenteRetencion);setCorreccionRetencion(d.correccionRetencion);setMedioPagoDetraccion(d.medioPagoDetraccion);
      borradorLocal.retomado();setErrorBorrador('');
    }catch{setErrorBorrador('No se pudo comprobar el cliente del borrador. Reintente la recuperación con conexión.');}
  };

  const emitir = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!puedeOperar || enviando) return;
    if (incidencias.length) {
      feedback.mostrar(); setResultado(null); revisionConfirmada.current=false;
      requestAnimationFrame(()=>resumenErroresRef.current?.focus()); return;
    }
    if (!revisionConfirmada.current) {setRevisar(true);return;}
    revisionConfirmada.current=false;
    (evento.currentTarget.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus();
    if (!serieActual) { setResultado({ ok: false, mensaje: 'Configure una serie activa para este tipo de comprobante.' }); return; }

    setResultado(null);

    // Validaciones locales para que el usuario vea el problema en el mismo
    // formulario. El backend las repite: esto no sustituye su validación.
    const problemaSpot = problemaSpotMinimo(items, tipo);
    if (problemaSpot) { setResultado({ ok: false, mensaje: problemaSpot }); return; }
    if (detraccion.aplica && !medioPagoDetraccion) {
      setResultado({ ok: false, mensaje: 'Seleccione el medio de pago de la detracción.' });
      return;
    }
    if (problemaFecha) {
      setResultado({ ok: false, mensaje: problemaFecha });
      return;
    }
    if (!clienteDoc.trim()) {
      setResultado({
        ok: false,
        mensaje:
          tipo === '01'
            ? 'La factura exige el RUC del cliente.'
            : 'Indique el documento del comprador.',
      });
      return;
    }
    if (!documentoValidoParaTipo(tipo, clienteDoc.trim())) {
      setResultado({ ok: false, mensaje: mensajeErrorDocumento(tipo) });
      return;
    }
    const problemasContenido = problemasContenidoEmision({ tipo, clienteRazonSocial, items, descuentoGlobal });
    if (problemasContenido.length) {
      setResultado({ ok: false, mensaje: problemasContenido[0] });
      return;
    }

    // El docente: "la cantidad tiene que ser validada dependiendo de lo que
    // tienes". Se detiene ANTES de llamar al backend: el backend también lo
    // rechaza, pero avisar aquí evita que el usuario espere una respuesta para
    // enterarse de algo que la pantalla ya sabe.
    const revision = revisarGrilla(items, productos, { nota: esNota });
    const primerError = primeraLineaConError(revision);
    if (primerError) {
      setResultado({
        ok: false,
        mensaje: `Línea ${primerError.indice + 1}: ${primerError.mensaje}`,
      });
      return;
    }

    // Una venta al crédito sin cronograma válido no se manda: el backend la
    // rechazaría y el usuario habría esperado una vuelta completa. La regla
    // 3319 exige que las cuotas sumen el neto pendiente sin tolerancia.
    if (formaPago === 'Credito') {
      const revision = validarCronograma(cuotas, netoPendiente, fechaEmision);
      if (!revision.cuadra || revision.errores.length > 0) {
        setResultado({
          ok: false,
          mensaje:
            revision.errores[0] ??
            `El cronograma no cuadra: las cuotas suman ${revision.suma.toFixed(2)} ` +
              `y el neto pendiente es ${revision.netoPendiente.toFixed(2)}.`,
        });
        return;
      }
    }

    let payloadPendiente: ReturnType<typeof borradorAPayloadEmision> | null = null;
    setEnviando(true);
    try {
      /**
       * UNIFICACIÓN: el payload sale del traductor compartido.
       *
       * Antes esta pantalla armaba el objeto a mano (tipo, serie, documento,
       * cuotas e ítems, 40 líneas de traducción) mientras el modal usaba
       * `borradorAPayloadEmision`. Dos implementaciones de «cómo se manda un
       * comprobante» significan que un arreglo en una no llega a la otra: así se
       * quedó fuera el `fecha_emision` aquí y la comprobación de stock allá.
       *
       * Se compone un `BorradorEmision` con los campos de esta pantalla y se
       * delega la traducción. El backend liquida los impuestos, valida el stock
       * y reserva el correlativo; el número de la respuesta es el real.
       */


      payloadPendiente = borradorAPayloadEmision(borradorCompleto);
      if (esNota) await notaEmision.comprobarSaldoActual();
      const r: ResultadoEmisionBackend = await invoicesApi.emitirComprobante(payloadPendiente, intento.current.clavePara(payloadPendiente));
      intento.current.completar();
      borradorLocal.descartar();
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });

      setResultado({
        ok: true,
        numero: r.numero,
        mensaje:
          `Registrado por S/ ${r.monto_total.toFixed(2)} con ${r.lineas.length} ` +
          'línea(s). Queda PENDIENTE de envío: el CDR se consulta en la bandeja. ' +
          'Aquí todavía no hay respuesta de SUNAT.',
        avisos: r.avisos,
      });

      // La grilla se limpia para no reenviar la misma venta por doble clic.
      setItems([]);
      if (esNota) { setNota(prev => ({ ...prev, documentoAfectado: '' })); setPreservarItemsNota(false); }
      setMedioPagoDetraccion('');
      // Solo lectura: actualizar el dato informativo, nunca reservar numeración.
      void apiClient.get<ConfiguracionBackend>('/invoices/config').then(({ data }) => setSeriesConfiguradas(data.series ?? [])).catch(() => {});
    } catch (error: unknown) {
      const sinRespuesta =
        !(error as { response?: unknown })?.response &&
        (!navigator.onLine || (error instanceof Error && 'response' in error));
      if (sinRespuesta) {
        if (payloadPendiente) {
          await enqueueInvoiceEmission(payloadPendiente, intento.current.clavePara(payloadPendiente));
        }
        setResultado({
          ok: true,
          numero: 'PENDIENTE',
          mensaje:
            'Sin conexión: el comprobante quedó en cola y se enviará al reconectar. ' +
            'Todavía no tiene número ni CDR de SUNAT.',
          avisos: [],
        });
        return;
      }

      // NO se inventa un CDR ni un número. Si el backend rechaza, se dice por
      // qué: el mensaje del backend explica qué falta (stock, RUC, correlativo).
      const mensaje =
        mensajeErrorEmision(error);
      setResultado({
        ok: false,
        mensaje: `No se pudo emitir el comprobante: ${mensaje}`,
      });
    } finally {
      setEnviando(false);
    }
  };

  const teclado = useInvoiceKeyboard(agregarItem, () => formRef.current?.requestSubmit(), enviando || !puedeOperar, formRef);
  return (
    <Page>
      <PageHeader
        title="Emisión de Comprobantes Electrónicos"
        description="Facturas y boletas con detalle de varias líneas, stock validado y liquidación real"
      />

      {defaultsError && <p role="alert">No se pudo leer el pago predeterminado. Verifique la forma y el medio antes de emitir.</p>}
      <form noValidate ref={formRef} onChangeCapture={borradorLocal.marcar} onBlurCapture={feedback.alSalir} onFocusCapture={feedback.alEntrar} onKeyDown={teclado.handler} onSubmit={emitir} className="emision-etiquetas grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        {teclado.revision}
        {borradorLocal.disponible && <section className="space-y-2 rounded border p-3 lg:col-span-2" aria-label="Borrador disponible"><p>Hay un borrador guardado en este navegador.</p><Button type="button" variant="outline" onClick={()=>void retomar()}>Retomar borrador</Button><Button type="button" variant="ghost" onClick={borradorLocal.descartar}>Descartar borrador</Button></section>}
        {borradorLocal.savedAt && <p role="status" className="text-xs lg:col-span-2">Borrador guardado {new Date(borradorLocal.savedAt).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false})}</p>}
        {errorBorrador && <p role="alert" className="lg:col-span-2">{errorBorrador}</p>}
        {feedback.enviado && incidencias.length>0 && <InvoiceErrorSummary issues={incidencias} formRef={formRef} summaryRef={resumenErroresRef}/>}

        <section aria-labelledby="emision-operacion" className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle id="emision-operacion" className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" /> Operación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {esNota && <InvoiceNoteFields borrador={borradorCompleto} actualizar={actualizarNota} existentes={notaEmision.existentes} saldoNota={notaEmision.saldoNota.data} total={importeTotal} />}
              {esNota && notaEmision.avisoLineas && <p role="status">{notaEmision.avisoLineas}</p>}
              {esNota && notaEmision.pendientes.length > 0 && <div className="rounded border p-3 text-sm" aria-label="Requisitos de la nota">{notaEmision.pendientes.map((p,i) => <p key={i}>{p.mensaje}</p>)}</div>}
              <h3 className="text-sm font-medium">Cliente</h3>
              <CustomerLookupField
                disabled={esNota && Boolean(notaEmision.afectado)}
                erroresExternos={{documento:feedback.mensaje('#doc-cliente'),nombre:feedback.mensaje('#razon-cliente')}}
                unico={tipo === '03'}
                documento={clienteDoc}
                razonSocial={clienteRazonSocial}
                labelDocumento={
                  tipo === '01'
                    ? 'RUC del cliente'
                    : 'DNI / documento del comprador'
                }
                placeholderDocumento={tipo === '01' ? '20100070970' : '70123456'}
                errorDocumento={clienteDoc.length > 0 && !documentoValidoParaTipo(tipo, clienteDoc) ? mensajeErrorDocumento(tipo) : undefined}
                onDocumentoChange={(valor) => {
                  if (tipo !== '03') rucAutofill.consultar(valor);
                  setClienteDireccion('');
                  const identidad = editarIdentidadCliente({ documento: clienteDoc, razonSocial: clienteRazonSocial, confirmado: Boolean(clienteSeleccionado) }, 'documento', valor);
                  setClienteSeleccionado(null);
                  setClienteDoc(identidad.documento);
                  setClienteRazonSocial(identidad.razonSocial);
                  setFormaPago('Contado');
                  setCuotas([]);
                  setDescuentoGlobal(null);
                  setItems((prev) => prev.map((it) => ({ ...it, descuento: null })));
                }}
                onRazonSocialChange={(valor) => {
                  rucAutofill.cancelar();
                  if (clienteSeleccionado) setClienteDireccion('');
                  const identidad = editarIdentidadCliente({ documento: clienteDoc, razonSocial: clienteRazonSocial, confirmado: Boolean(clienteSeleccionado) }, 'nombre', valor);
                  setClienteSeleccionado(null);
                  setClienteDoc(tipo === '03' ? '' : identidad.documento);
                  setClienteRazonSocial(identidad.razonSocial);
                  setFormaPago('Contado');
                  setCuotas([]);
                  setDescuentoGlobal(null);
                  setItems((prev) => prev.map((it) => ({ ...it, descuento: null })));
                }}
                onElegir={(cliente) => {
                  rucAutofill.cancelar();
                  setClienteDireccion(cliente.direccion ?? '');
                  setClienteSeleccionado(cliente);
                  setClienteDoc(cliente.numeroDocumento);
                  setClienteRazonSocial(cliente.razonSocial);
                  // El tipo sugerido sigue al documento del cliente; el usuario
                  // puede cambiarlo después si necesita una boleta con RUC.
                  if (cliente.tipoDocumento === '6' && tipo !== '03') setTipo('01');
                  else if (cliente.tipoDocumento === '1') { setTipo('03'); setFormaPago('Contado'); setCuotas([]); }
                  if (cliente.tieneCredito !== true) {
                    setFormaPago('Contado');
                    setCuotas([]);
                  }
                  if (cliente.admiteDescuento !== true) {
                    setDescuentoGlobal(null);
                    setItems((prev) => prev.map((it) => ({ ...it, descuento: null })));
                  }
                }}
              />
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="direccion-cliente" className="text-xs font-medium">Dirección del cliente</label>
                <Input disabled={esNota && Boolean(notaEmision.afectado)} id="direccion-cliente" maxLength={1500} aria-label="Dirección del cliente" value={clienteDireccion} onChange={(e) => { rucAutofill.cancelar(); setClienteDireccion(e.target.value); }} />
              </div>
              {rucAutofill.aviso && <PageText role="status" className="sm:col-span-2">{rucAutofill.aviso}</PageText>}

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <InvoiceWarehouseSelect value={almacen} onChange={setAlmacen} />
                <div className="min-w-0 space-y-1.5 text-sm font-medium">
                  <label htmlFor="serie-cpe">Serie configurada</label>
                  <select disabled={esNota && Boolean(nota.documentoAfectado)} id="serie-cpe" aria-invalid={Boolean(feedback.mensaje('#serie-cpe'))} aria-describedby={feedback.mensaje('#serie-cpe')?'serie-emision-error':undefined} value={serieActual} onChange={e => setSerieElegida(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                    {!seriesDelTipo.length && <option value="">{estadoConfiguracion === 'cargando' ? 'Cargando configuración…' : estadoConfiguracion === 'error' ? 'No se pudo cargar la configuración' : 'Sin serie activa'}</option>}
                    {seriesDelTipo.map(s => <option key={s.series} value={s.series}>{s.series}</option>)}
                  </select>
                  <InlineInvoiceError id="serie-emision-error" mensaje={feedback.mensaje('#serie-cpe')}/>
                  <InvoiceNextNumber cargando={estadoConfiguracion === 'cargando'} error={estadoConfiguracion === 'error'} serie={serieActual} actual={seriesDelTipo.find(s => s.series === serieActual)?.current_correlative} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Detalle de bienes y servicios</CardTitle></CardHeader>
            <CardContent className="min-w-0 space-y-4">
              <InvoiceItemsGrid esNota={esNota} cantidadesMaximas={tipo === '07' ? limitesNota(items, notaEmision.saldoNota.data?.cantidades_pendientes, nota.motivoCodigo, notaEmision.saldoNota.data?.motivos_totales).maximos : undefined} mostrarErrores={feedback.enviado} codigoSoloCatalogo tipo={tipo} catalogoEstado={catalogoEstado}
                items={items}
                onCambiar={cambiarItem}
                onEliminar={eliminarItem}
                onAgregar={agregarItem}
                onAgregarBolsa={indice => setItems(prev => actualizarItem(prev, indice, {cantidadBolsas: cantidadBolsasDe(prev[indice]) + 1}))}
                productos={productos}
                onAgregarConProducto={agregarConProducto}
                admiteDescuento={clienteSeleccionado?.admiteDescuento === true}
              />
              {ultimaLineaQuitada && <p role="status" className="text-sm">Ítem retirado. <Button type="button" variant="link" onClick={()=>{setItems(prev=>{const next=[...prev];next.splice(Math.min(ultimaLineaQuitada.indice,next.length),0,ultimaLineaQuitada.item);return next;});setUltimaLineaQuitada(null);borradorLocal.marcar();}}>Deshacer quitar ítem</Button></p>}
              <InvoiceDescuentoGlobal error={feedback.mensaje('[data-invoice-discount]')}
                valor={descuentoGlobal}
                disabled={clienteSeleccionado?.admiteDescuento !== true}
                onChange={setDescuentoGlobal}
              />
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="emision-facturacion" className="min-w-0">
          <Card className="gap-0 overflow-visible">
            <CardHeader className="pb-4">
              <CardTitle id="emision-facturacion" className="text-base">Facturación y pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <div className="space-y-1.5">
                  <label
                    htmlFor="tipo-cpe"
                    className="text-xs font-medium text-foreground"
                  >
                    Tipo de comprobante
                  </label>
                  <select
                    id="tipo-cpe"
                    value={tipo}
                    onChange={(e) => {
                      cambiarTipoEmision(e.target.value as TipoEmisible);
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="01">Factura Electrónica</option>
                    <option value="03">Boleta de Venta Electrónica</option>
                    <option value="07">Nota de Crédito</option><option value="08">Nota de Débito</option>
                  </select>

              </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="fecha-emision"
                    className="text-xs font-medium text-foreground"
                  >
                    Fecha de emisión
                  </label>
                  <Input
                    id="fecha-emision"
                    type="date"
                    min={minimoDeFechaEmision(undefined, tipo)}
                    max={topeDeFechaEmision()}
                    value={fechaEmision}
                    readOnly={!canEditDate}
                    aria-invalid={Boolean(feedback.mensaje('#fecha-emision'))}
                    aria-describedby={feedback.mensaje('#fecha-emision')?'fecha-emision-error':!canEditDate?'fecha-emision-permiso':undefined}
                    onChange={(e) => { if (canEditDate) cambiarFecha(e.target.value); }}
                  />
                  {dateExplanation && <PageText id="fecha-emision-permiso" variant="caption">{dateExplanation}</PageText>}
                  <InlineInvoiceError id="fecha-emision-error" mensaje={feedback.mensaje('#fecha-emision')} />
                  {!problemaFecha && formaPago === 'Credito' && cuotas.length > 0 && (
                    <PageText variant="caption">
                      Los vencimientos conservan su plazo respecto de la nueva
                      fecha.
                    </PageText>
                  )}
                </div>
              <RetencionMaestro spot={detraccion.monto > 0} documento={clienteDoc} razonSocial={clienteRazonSocial} valor={esNota ? false : agenteRetencion} disabled={esNota}
                onChange={(valor, correccion) => { if (!esNota) { setAgenteRetencion(valor); setCorreccionRetencion(correccion); } }} />
              <InvoicePaymentPanel
                formaPago={formaPago}
                medioPago={medioPago}
                creditoHabilitado={(tipo === '07' && nota.motivoCodigo === '13') || (tipo === '01' && clienteSeleccionado?.tieneCredito === true)}
                pagoDirecto={pagoSegunDeposito(importeTotal, detraccion.monto, retencion).pagoDirecto}
                onCambiar={(forma, medio) => {
                  setFormaPago(forma);
                  if (medio) setMedioPago(medio);
                  setCuotas(forma === 'Credito' ? repartirEnCuotas(netoPendiente, esNota ? borradorCompleto.numeroCuotas : 1, fechaEmision) : []);
                }}
              />
              {formaPago === 'Credito' && (
                <div id="emision-cuotas" tabIndex={-1}><CreditInstallmentsEditor mostrarErrores={feedback.enviado}
                  cuotas={cuotas}
                  netoPendiente={netoPendiente}
                  fechaEmision={fechaEmision}
                  onCambiar={setCuotas}
                /><InlineInvoiceError mensaje={feedback.mensaje('#emision-cuotas')}/></div>
              )}
              <div className="space-y-4">
              <h3 id="emision-liquidacion" tabIndex={-1} className="text-sm font-semibold">Liquidación</h3>
              <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Op. gravada</span>
                <span>S/ {porAfectacion.GRAVADA.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Op. exonerada</span>
                <span>S/ {porAfectacion.EXONERADA.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Op. inafecta</span>
                <span>S/ {porAfectacion.INAFECTA.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IGV (18 %)</span>
                <span>S/ {totales.igv.toFixed(2)}</span>
              </div>
              {items.some(i => i.afectacion === 'GRATUITA') && <div className="flex justify-between"><span>Op. gratuita (referencial)</span><span>S/ {items.filter(i => i.afectacion === 'GRATUITA').reduce((s, i) => s + i.cantidad * i.valorUnitario, 0).toFixed(2)}</span></div>}
              {igvReferencial > 0 && <div className="flex justify-between"><span>IGV referencial (no se cobra)</span><span>S/ {igvReferencial.toFixed(2)}</span></div>}
              {descuentoGlobal && <div className="flex justify-between"><span>Descuento global ({descuentoGlobal.codigo})</span><span>− S/ {descuentoGlobal.monto.toFixed(2)}</span></div>}
              {totales.icbper > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>ICBPER</span>
                  <span>S/ {totales.icbper.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Importe total</span>
                <span className="text-primary">
                  S/ {reparto.importeTotal.toFixed(2)}
                </span>
              </div>

              {/*
                El docente: "los productos son con detracción, no la factura".
                Por eso se muestra qué línea la genera y cuánto, no un porcentaje
                suelto sobre el total.
              */}
              <InlineInvoiceError mensaje={feedback.mensaje('[aria-label="Medio de pago de la detracción"]')}/>
              <MedioPagoDetraccionSelect aplica={detraccion.aplica} value={medioPagoDetraccion} onChange={setMedioPagoDetraccion} />
              {detraccion.aplica ? (
                <div className="space-y-1 border-t border-border pt-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      Detracción (Cat. 54 {detraccion.codigos.join(', ')})
                    </span>
                    <span>S/ {detraccion.monto.toFixed(2)}</span>
                  </div>
                  <PageText variant="caption">
                    Depósito en el Banco de la Nación: S/ {roundDetraccion(detraccion.monto).toFixed(2)}. Solo sobre la base de
                    las líneas sujetas (S/ {detraccion.baseSujeta.toFixed(2)}).
                  </PageText>
                </div>
              ) : (
                detraccion.motivoNoAplica && (
                  <PageText variant="caption">
                    {detraccion.motivoNoAplica}
                  </PageText>
                )
              )}

              {reparto.retenidoIgv > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Retención IGV (3 %)</span>
                  <span>S/ {reparto.retenidoIgv.toFixed(2)}</span>
                </div>
              )}

              {detraccion.aplica && formaPago === 'Credito' && <PageText variant="caption">El neto fiscal de las cuotas conserva la detracción exacta; el pago directo mostrado usa el depósito BN redondeado.</PageText>}
              {(detraccion.aplica || reparto.retenidoIgv > 0) && (
                <div className="flex justify-between border-t border-border pt-2 text-xs font-medium">
                  <span>Pago directo al proveedor</span>
                  <span>S/ {pagoSegunDeposito(importeTotal, detraccion.monto, retencion).pagoDirecto.toFixed(2)}</span>
                </div>
              )}
              </div>
            <InvoiceWriteButton
              type="submit"
              aria-label={enviando ? 'Emitiendo…' : 'Emitir comprobante'}
              size="lg"
              disabled={enviando}
              className="w-full"
            >
              <Send className="mr-2 h-4 w-4" />
              {enviando ? 'Emitiendo…' : 'Revisar y emitir'}
            </InvoiceWriteButton>
              </div>
            </CardContent>
          </Card>
          {resultado && (
            <Alert variant={resultado.ok ? 'info' : 'destructive'}>
              <AlertTitle>
                {resultado.ok ? 'Comprobante registrado' : 'No se emitió'}
              </AlertTitle>
              <AlertDescription>
                {resultado.numero && (
                  <Badge variant="secondary" className="mr-2 font-mono">
                    {resultado.numero}
                  </Badge>
                )}
                {resultado.mensaje}
                {resultado.avisos && resultado.avisos.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs">
                    {resultado.avisos.map((aviso) => (
                      <li key={aviso}>{aviso}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </section>
        {!puedeOperar && <p className="text-sm lg:col-start-2">Emisión no disponible. Espere la verificación de permisos; si persiste, solicite acceso al administrador.</p>}
        {enviando && <p role="status" className="text-sm lg:col-start-2">La emisión está en curso. Espere el resultado antes de repetir.</p>}
        <div aria-label="Resumen de pago" className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-2 rounded-lg border bg-background px-4 py-3 shadow-lg lg:hidden">
          <span className="text-sm font-medium">Total a pagar</span>
          <span className="flex items-baseline gap-1 font-semibold tabular-nums text-primary"><span>S/</span><span>{pagoSegunDeposito(importeTotal, detraccion.monto, retencion).pagoDirecto.toFixed(2)}</span></span>
        </div>
      </form>
      <InvoiceReview open={revisar} close={()=>setRevisar(false)} cliente={`${clienteDoc} · ${clienteRazonSocial}`} items={items} total={importeTotal} importes={{base:totales.gravado,igv:totales.igv,icbper:totales.icbper,detraccion:detraccion.monto,retencion}} pago={formaPago==='Credito'?'Crédito':medioPago}
        change={selector=>{setRevisar(false);requestAnimationFrame(()=>{const field=formRef.current?.querySelector<HTMLElement>(selector);field?.scrollIntoView?.({block:'center'});field?.focus();});}}
        confirm={()=>{setRevisar(false);revisionConfirmada.current=true;formRef.current?.requestSubmit();}}/>
    </Page>
  );
}

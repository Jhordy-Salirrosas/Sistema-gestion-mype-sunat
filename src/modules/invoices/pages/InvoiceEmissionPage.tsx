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
  Page,
  PageHeader,
  PageText,
} from '@/components/ui';
import { FileText, Send, Plus } from 'lucide-react';
import { documentoValidoParaTipo, mensajeErrorDocumento } from '../lib/invoiceEmitValidation';
import { CustomerLookupField } from '../components/CustomerLookupField';
import { InvoiceItemsGrid } from '../components/InvoiceItemsGrid';
import { InvoiceDescuentoGlobal } from '../components/InvoiceDescuentoGlobal';
import { liquidarDescuentoGlobal, type DescuentoGlobal } from '../lib/invoiceDescuentoGlobal';
import { detraccionConDescuento } from '../lib/invoiceDetraccionGlobal';
import { CreditInstallmentsEditor } from '../components/CreditInstallmentsEditor';
import {
  actualizarItem,
  calcularItem,
  itemDesdeProducto,
  itemVacio,
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
  const [searchParams] = useSearchParams();
  const tipoQuery = searchParams.get('tipo');
  const [tipo, setTipo] = useState<'01' | '03'>(
    tipoQuery === '03' ? '03' : '01',
  );

  const [seriesConfiguradas, setSeriesConfiguradas] = useState<NonNullable<ConfiguracionBackend['series']>>([]);
  const [estadoConfiguracion, setEstadoConfiguracion] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [serieElegida, setSerieElegida] = useState('');
  const seriesDelTipo = seriesConfiguradas.filter(s => s.document_type === tipo && s.is_active);
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
        if (sugerido && tipoQuery !== '01' && tipoQuery !== '03') setTipo(sugerido);
      })
      .catch(() => { if (vivo) setEstadoConfiguracion('error'); });
    return () => {
      vivo = false;
    };
  }, [tipoQuery]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<import('../lib/invoiceSearch').ClienteBuscado | null>(null);
  const [clienteDoc, setClienteDoc] = useState('');
  const [clienteRazonSocial, setClienteRazonSocial] = useState('');
  const [items, setItems] = useState<readonly ItemBorrador[]>([itemVacio('1')]);
  const [descuentoGlobal, setDescuentoGlobal] = useState<DescuentoGlobal | null>(null);
  const [agenteRetencion, setAgenteRetencion] = useState(false);
  const [correccionRetencion, setCorreccionRetencion] = useState(false);
  // Forma de pago y cronograma (HU-10). Antes la pantalla mandaba siempre
  // 'Contado'; el selector vivía solo en el modal de la bandeja. Las funciones
  // que reparten las cuotas ya existían y estaban probadas en
  // `invoiceEmitDraft`, así que aquí solo se guarda el estado.
  const [formaPago, setFormaPago] = useState<'Contado' | 'Credito'>('Contado');
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
    cargarProductosAlmacen(almacen).then((lista) => {
      if (vivo) { setProductos(lista); setCatalogoEstado('listo'); }
    }).catch(() => { if (vivo) setCatalogoEstado('error'); });
    return () => {
      vivo = false;
    };
  }, [almacen]);

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

  // Detracción por LÍNEA: "los productos son con detracción, no la factura".
  const detraccion = useMemo(
    () => detraccionConDescuento(items, descuentoGlobal),
    [items, descuentoGlobal],
  );

  // Retención del IGV: es del CLIENTE, no del comprobante.
  const retencion = useMemo(
    () => calcularRetencion(importeTotal, agenteRetencion),
    [importeTotal, agenteRetencion],
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
  }, [tipo, clienteSeleccionado, clienteDoc, clienteRazonSocial, items, descuentoGlobal, agenteRetencion, correccionRetencion, formaPago, cuotas, medioPagoDetraccion, fechaEmision]);

  /** Motivo por el que la fecha de emisión no sirve, o `null` (D9). */
  const problemaFecha = problemaDeFechaEmision(fechaEmision);

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
    setItems((prev) => [...prev, itemVacio(String(Date.now()))]);
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

  const eliminarItem = (indice: number) => {
    if (items.length === 1) return;
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

    setItems((prev) => {
      const vacia = prev.findIndex(
        (i) => !i.descripcion.trim() && !i.codigo.trim(),
      );
      if (vacia >= 0) {
        return prev.map((item, i) =>
          i === vacia ? { ...item, ...relleno, clave: item.clave } : item,
        );
      }
      return [...prev, { ...relleno, clave: String(Date.now()) }];
    });
  };

  const emitir = async (evento: React.FormEvent) => {
    evento.preventDefault();
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
    const revision = revisarGrilla(items, productos);
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
      const borradorCompleto: BorradorEmision = {
        almacen,
        tipo,
        serie: serieActual,
        correlativo: 0, // lo asigna la serie en el backend
        clienteId: clienteSeleccionado?.id,
        clienteTipoDocumento: clienteSeleccionado?.tipoDocumento,
        clienteDireccion: clienteSeleccionado?.direccion,
        clienteDoc,
        clienteTipoDoc: tipo === '01' ? '6' : '1',
        clienteRazonSocial,
        items,
        descuentoGlobal,
        formaPago,
        cuotas,
        numeroCuotas: cuotas.length || 2,
        codigoDetraccion: '',
        medioPagoDetraccion,
        agenteRetencion,
        correccionRetencion,
        bolsas: 0,
        documentoAfectado: '',
        tipoDocumentoAfectado: '0101',
        motivoCodigo: '',
        motivoDescripcion: '',
        fecha: fechaEmision,
      };

      payloadPendiente = borradorAPayloadEmision(borradorCompleto);
      const r: ResultadoEmisionBackend = await invoicesApi.emitirComprobante(payloadPendiente, intento.current.clavePara(payloadPendiente));
      intento.current.completar();

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
      setItems([itemVacio('1')]);
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

  const teclado = useInvoiceKeyboard(agregarItem, () => formRef.current?.requestSubmit(), enviando, formRef);
  return (
    <Page>
      <PageHeader
        title="Emisión de Comprobantes Electrónicos"
        description="Facturas y boletas con detalle de varias líneas, stock validado y liquidación real"
      />

      <form ref={formRef} onKeyDown={teclado.handler} onSubmit={emitir} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3">{teclado.ayuda}</div>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Datos del comprobante y del cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      setTipo(e.target.value as '01' | '03');
                      setResultado(null);
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="01">Factura Electrónica</option>
                    <option value="03">Boleta de Venta Electrónica</option>
                  </select>
                  <label htmlFor="serie-cpe">Serie configurada</label>
                  <select id="serie-cpe" value={serieActual} onChange={e => setSerieElegida(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                    {!seriesDelTipo.length && <option value="">{estadoConfiguracion === 'cargando' ? 'Cargando configuración…' : estadoConfiguracion === 'error' ? 'No se pudo cargar la configuración' : 'Sin serie activa'}</option>}
                    {seriesDelTipo.map(s => <option key={s.series} value={s.series}>{s.series}</option>)}
                  </select>
                  <InvoiceNextNumber cargando={estadoConfiguracion === 'cargando'} error={estadoConfiguracion === 'error'} serie={serieActual} actual={seriesDelTipo.find(s => s.series === serieActual)?.current_correlative} />
                </div>

                {/*
                  D9 · Fecha de emisión editable, precargada con hoy en Lima.
                  Antes era un `useState` congelado: la venta del viernes que se
                  registra el lunes no se podía fechar el viernes. El tope
                  superior es hoy y el inferior, el plazo del resumen diario
                  (regla 2957), porque fuera de él la boleta nace sin forma de
                  informarse.
                */}
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
                    min={minimoDeFechaEmision()}
                    max={topeDeFechaEmision()}
                    value={fechaEmision}
                    onChange={(e) => cambiarFecha(e.target.value)}
                  />
                  {problemaFecha && (
                    <PageText variant="error">{problemaFecha}</PageText>
                  )}
                  {!problemaFecha && formaPago === 'Credito' && cuotas.length > 0 && (
                    <PageText variant="caption">
                      Los vencimientos conservan su plazo respecto de la nueva
                      fecha.
                    </PageText>
                  )}
                </div>
              </div>

              <RetencionMaestro documento={clienteDoc} razonSocial={clienteRazonSocial} valor={agenteRetencion}
                onChange={(valor, correccion) => { setAgenteRetencion(valor); setCorreccionRetencion(correccion); }} />

              {/*
                HU-10: forma de pago. Antes esta pantalla mandaba siempre
                'Contado' y el selector solo existía en el modal de la bandeja,
                así que una venta al crédito no se podía emitir desde aquí.
                Al pasar a Crédito se reparte el neto pendiente en una cuota
                por defecto, que el usuario puede editar abajo.
              */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-foreground">
                  Forma de pago
                </span>
                <div className="flex gap-2">
                  {(['Contado', 'Credito'] as const).map((forma) => {
                    const creditoHabilitado =
                      clienteSeleccionado?.tieneCredito === true;
                    return (
                      <Button
                        key={forma}
                        type="button"
                        size="sm"
                        disabled={forma === 'Credito' && !creditoHabilitado}
                        variant={formaPago === forma ? 'default' : 'outline'}
                        onClick={() => {
                          if (forma === 'Credito' && !creditoHabilitado) return;
                          setFormaPago(forma);
                          setCuotas(
                            forma === 'Credito'
                              ? repartirEnCuotas(netoPendiente, 1, fechaEmision)
                              : [],
                          );
                        }}
                      >
                        {forma === 'Credito' ? 'Crédito' : 'Contado'}
                      </Button>
                    );
                  })}
                </div>
                {clienteSeleccionado?.tieneCredito !== true && (
                  <PageText variant="caption">
                    La venta al crédito con cuotas solo se habilita para
                    clientes con crédito registrado en el maestro.
                  </PageText>
                )}
              </div>

              {formaPago === 'Credito' && (
                <CreditInstallmentsEditor
                  cuotas={cuotas}
                  netoPendiente={netoPendiente}
                  fechaEmision={fechaEmision}
                  onCambiar={setCuotas}
                />
              )}

              {/*
                El docente: el cliente "que no lo escriba, que lo busque". Este
                campo busca en la cartera de la empresa y rellena documento y
                razón social.
              */}
              <CustomerLookupField
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
                  const identidad = editarIdentidadCliente({ documento: clienteDoc, razonSocial: clienteRazonSocial, confirmado: Boolean(clienteSeleccionado) }, 'nombre', valor);
                  setClienteSeleccionado(null);
                  setClienteDoc(identidad.documento);
                  setClienteRazonSocial(identidad.razonSocial);
                  setFormaPago('Contado');
                  setCuotas([]);
                  setDescuentoGlobal(null);
                  setItems((prev) => prev.map((it) => ({ ...it, descuento: null })));
                }}
                onElegir={(cliente) => {
                  setClienteSeleccionado(cliente);
                  setClienteDoc(cliente.numeroDocumento);
                  setClienteRazonSocial(cliente.razonSocial);
                  // El tipo sugerido sigue al documento del cliente; el usuario
                  // puede cambiarlo después si necesita una boleta con RUC.
                  if (cliente.tipoDocumento === '6') setTipo('01');
                  else if (cliente.tipoDocumento === '1') setTipo('03');
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


            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Detalle de bienes y servicios
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={agregarItem}
              >
                <Plus className="mr-1 h-4 w-4" /> Añadir ítem
              </Button>
            </CardHeader>
            <CardContent>
              <InvoiceWarehouseSelect value={almacen} onChange={setAlmacen} />
              <InvoiceItemsGrid catalogoEstado={catalogoEstado}
                items={items}
                onCambiar={cambiarItem}
                onEliminar={eliminarItem}
                onAgregar={agregarItem}
                onAgregarBolsa={indice => setItems(prev => actualizarItem(prev, indice, {cantidadBolsas: cantidadBolsasDe(prev[indice]) + 1}))}
                productos={productos}
                onAgregarConProducto={agregarConProducto}
                admiteDescuento={clienteSeleccionado?.admiteDescuento === true}
              />
              <InvoiceDescuentoGlobal
                valor={descuentoGlobal}
                disabled={clienteSeleccionado?.admiteDescuento !== true}
                onChange={setDescuentoGlobal}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={enviando}
              className="min-w-[200px]"
            >
              <Send className="mr-2 h-4 w-4" />
              {enviando ? 'Emitiendo…' : 'Emitir comprobante'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Liquidación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
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
        </div>
      </form>
    </Page>
  );
}

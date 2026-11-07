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
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscarAfectado } from '../lib/invoiceNotaOrigen';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PageText,
} from '@/components/ui';
import type { ComprobanteDemo } from '../data/invoiceDemoTypes';
import type { ResultadoEmisionBackend } from '../types/invoiceEmision.types';
import { invoicesApi } from '../services/invoicesApi';
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
  siguienteCorrelativo,
} from '../lib/invoiceEmitDraft';
import type { BorradorEmision } from '../lib/invoiceEmitDraft';
import {
  actualizarItem,
  agregarItem,
  eliminarItem,
  itemBolsa,
  itemDesdeProducto,
  itemVacio,
  validarItems,
  type ItemBorrador,
} from '../lib/invoiceItems';
import type { ProductoBuscado } from '../lib/invoiceSearch';
import { revisarGrilla } from '../lib/invoiceStockLinea';
import {
  buscarDetraccion,
  esDetraccionDadaDeBaja,
  validarCronograma,
} from '../lib/invoiceDetraccion';
import { liquidarDescuentoGlobal } from '../lib/invoiceDescuentoGlobal';
import { MedioPagoDetraccionSelect } from './MedioPagoDetraccionSelect';
import { calcularFlujo } from '../lib/invoiceFlujoPago';
export { calcularFlujo } from '../lib/invoiceFlujoPago';
import { InvoiceEmitCampos } from './InvoiceEmitCampos';
import { lineasParaNota } from '../lib/invoiceLineasOrigen';
import { InvoiceEmitResumen } from './InvoiceEmitResumen';
import { RetencionMaestro } from './RetencionMaestro';
import { CreditInstallmentsEditor } from './CreditInstallmentsEditor';
import { problemasDeNota } from '../lib/invoiceNotaOrigen';

interface InvoiceEmitModalProps {
  tipoInicial: TipoEmisible;
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
  const motivos: string[] = [];
  const errorGlobal = liquidarDescuentoGlobal(b.items, b.descuentoGlobal).error;
  if (errorGlobal) motivos.push(errorGlobal);

  if (b.serie.length !== 4) motivos.push('La serie debe tener 4 caracteres.');

  // D9: la fecha de emisión es editable, así que puede quedar imposible.
  const problemaFecha = problemaDeFechaEmision(b.fecha);
  if (problemaFecha) motivos.push(problemaFecha);

  if (!documentoValidoParaTipo(b.tipo, b.clienteDoc)) {
    motivos.push(mensajeErrorDocumento(b.tipo));
  }

  // Errores de la grilla de detalle: se nombran con el número de línea.
  for (const error of validarItems(b.items)) {
    const etiqueta =
      error.indice >= 0 ? `Línea ${error.indice + 1}` : 'Detalle';
    for (const motivo of error.motivos) {
      motivos.push(`${etiqueta}: ${motivo}`);
    }
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
  for (const linea of revisarGrilla(b.items, productos).lineas) {
    if (linea.gravedad === 'error') {
      motivos.push(`Línea ${linea.indice + 1}: ${linea.mensaje}`);
    }
  }

  const esNota = esTipoNota(b.tipo);
  const { importeTotal, neto, detraccion } = calcularFlujo(b);
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

  if (b.formaPago === 'Credito') {
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
  fecha,
  existentes,
  productos = [],
  onEmitir,
  onCerrar,
}: InvoiceEmitModalProps) => {
  const [b, setB] = useState<BorradorEmision>(() => {
    const inicial = borradorInicial(tipoInicial, fecha);
    return {
      ...inicial,
      correlativo: siguienteCorrelativo(existentes, inicial.serie),
    };
  });

  /** `true` mientras la emisión viaja al backend; bloquea el doble envío. */
  const [enviando, setEnviando] = useState(false);
  /** Motivo por el que el backend rechazó, o por el que no se llegó a enviar. */
  const [errorEmision, setErrorEmision] = useState<string | null>(null);
  const [avisoLineas, setAvisoLineas] = useState('');

  const afectado = buscarAfectado(existentes, b.documentoAfectado);
  useEffect(() => {
    if (!esTipoNota(b.tipo) || !afectado) return;
    let vigente = true;
    const itemsIniciales = b.items;
    void Promise.resolve().then(() => invoicesApi.getInvoiceById(afectado.id)).then((detalle) => {
      if (!vigente) return;
      const lineas = lineasParaNota(detalle.lineasOrigen ?? []);
      if (lineas === null) {
        setAvisoLineas('Las líneas del origen contienen datos incompletos o no compatibles; ingréselas manualmente.');
        return;
      }
      setAvisoLineas('');
      if (lineas.length) setB((previo) => previo.items === itemsIniciales ? { ...previo, items: lineas } : previo);
    }).catch(() => { if (vigente) setAvisoLineas('No se pudieron cargar las líneas del origen; ingréselas manualmente.'); });
    return () => { vigente = false; };
  }, [afectado?.id, b.tipo]);
  const saldoNota = useQuery({
    queryKey: ['invoice-saldo-nota', afectado?.id],
    queryFn: () => invoicesApi.getSaldoNota(afectado!.id),
    enabled: esTipoNota(b.tipo) && !!afectado,
    staleTime: 0,
    retry: false,
  });

  const pendientesBase = useMemo(
    () => motivosPendientes(b, existentes, productos),
    [b, existentes, productos],
  );
  const flujo = calcularFlujo(b);
  const pendientes = [...pendientesBase];
  if (b.tipo === '07' && afectado) {
    if (!saldoNota.data || saldoNota.isFetching || saldoNota.isError) pendientes.push(saldoNota.isError ? 'No se pudo consultar el saldo de la nota; inténtelo de nuevo.' : 'Consultando saldo del comprobante…');
    else if (Math.round(flujo.importeTotal * 100) > Math.round(saldoNota.data.disponible * 100)) pendientes.push(`La nota supera el saldo disponible informado por el servidor (S/ ${saldoNota.data.disponible.toFixed(2)}).`);
  }
  const puedeEmitir = pendientes.length === 0;

  const actualizar = (parcial: Partial<BorradorEmision>) =>
    setB((previo) => {
      const siguiente = { ...previo, ...parcial };
      if (parcial.codigoDetraccion !== undefined && parcial.codigoDetraccion !== previo.codigoDetraccion) {
        siguiente.items = previo.items.map((item) => ({ ...item, codigoDetraccion: parcial.codigoDetraccion || undefined }));
      }
      if (parcial.documentoAfectado !== undefined && parcial.documentoAfectado !== previo.documentoAfectado) {
        siguiente.items = [itemVacio(nuevaClave())];
      }
      // El correlativo se recalcula cuando cambia la serie elegida.
      if (parcial.serie && parcial.serie !== previo.serie) {
        siguiente.correlativo = siguienteCorrelativo(
          existentes,
          parcial.serie,
        );
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

  const nuevoItem = () =>
    setB((previo) => ({
      ...previo,
      items: agregarItem(previo.items, itemVacio(nuevaClave())),
    }));

  /**
   * Agrega una línea con los datos del producto elegido en el buscador (TA-61).
   *
   * El valor unitario del catálogo se trata como el precio CON IGV incluido
   * cuando el producto lo trae así: es como se rotula en una ferretería
   * ("cemento S/ 32.90"). Si el producto no trae precio, la línea se crea igual
   * con 0 y el usuario lo completa, en lugar de no hacer nada y dejarle la
   * duda de si el clic funcionó.
   */
  const itemDeProducto = (producto: ProductoBuscado) =>
    setB((previo) => ({
      ...previo,
      items: agregarItem(previo.items, itemDesdeProducto(producto, nuevaClave())),
    }));

  const nuevaBolsa = () =>
    setB((previo) => {
      const cantidad = previo.bolsas > 0 ? previo.bolsas : 1;
      return {
        ...previo,
        items: agregarItem(previo.items, itemBolsa(nuevaClave(), cantidad)),
      };
    });

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
    if (!puedeEmitir || enviando) return;

    const problema = problemaDeCronograma(b);
    if (problema) {
      setErrorEmision(problema);
      return;
    }

    setEnviando(true);
    setErrorEmision(null);
    try {
      if (b.tipo === '07' && afectado) {
        const actual = await invoicesApi.getSaldoNota(afectado.id);
        if (Math.round(flujo.importeTotal * 100) > Math.round(actual.disponible * 100)) throw new Error('La nota supera el saldo actualizado del comprobante.');
      }
      const resultado = await invoicesApi.emitirComprobante(
        borradorAPayloadEmision(b),
      );
      onEmitir(resultado);
    } catch (error: unknown) {
      // NO se inventa un número ni un CDR: se muestra lo que dijo el backend.
      const mensaje =
        error instanceof Error ? error.message : 'Error desconocido';
      setErrorEmision(`No se pudo emitir el comprobante: ${mensaje}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Emitir Comprobante Electrónico</DialogTitle>
          <PageText variant="caption">
            Los montos se calculan con el motor tributario UBL 2.1 del módulo.
            El comprobante entra a la cola Outbox y sale con el CDR de SUNAT.
          </PageText>
        </DialogHeader>

        {avisoLineas && <p role="status">{avisoLineas}</p>}
        <InvoiceEmitCampos
          borrador={b}
          actualizar={actualizar}
          existentes={existentes}
          total={flujo.importeTotal}
          saldoNota={esTipoNota(b.tipo) ? saldoNota.data : undefined}
          onItemCambiado={cambiarItem}
          onItemEliminado={quitarItem}
          onItemAgregado={nuevoItem}
          onBolsaAgregada={nuevaBolsa}
          productos={productos}
          onItemDesdeProducto={itemDeProducto}
        />

        <div className="flex flex-wrap items-center gap-2">
          <PageText variant="label">Forma de pago</PageText>
          {(['Contado', 'Credito'] as const).map((forma) => (
            <Button
              key={forma}
              type="button"
              variant={b.formaPago === forma ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setB((previo) =>
                  cambiarFormaPago(previo, forma, flujo.neto),
                )
              }
            >
              {forma === 'Credito' ? 'Crédito' : 'Contado'}
            </Button>
          ))}
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
          <Button size="sm" onClick={confirmar} disabled={!puedeEmitir || enviando}>
            {enviando ? 'Emitiendo…' : `Emitir ${nombreDocumento}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

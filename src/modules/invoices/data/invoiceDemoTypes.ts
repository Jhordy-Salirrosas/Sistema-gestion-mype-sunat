/**
 * Fábrica de comprobantes de demostración (M1). Los montos se derivan con el
 * motor real de `../lib/invoiceCalculations`. Los tipos viven en
 * `./invoiceDemoSchema` y las utilidades de simulación (CDR, hash, cuotas) en
 * `./invoiceDemoHelpers`.
 */
import {
  calcularDetraccion,
  calcularRetencion,
  igvDesdeBase,
  round2,
} from '../lib/invoiceCalculations';
import {
  construirCuotas,
  descripcionCdr,
  hashSimulado,
} from './invoiceDemoHelpers';
import { itemsPorDefecto } from './invoiceDemoItems';
import type {
  ComprobanteDemo,
  FormaPago,
  ItemDemo,
  SemillaComprobante,
  TipoDocIdentidad,
  TipoOperacion,
} from './invoiceDemoSchema';

export type {
  ComprobanteDemo,
  CuotaDemo,
  EstadoCdrDemo,
  FormaPago,
  ItemDemo,
  MotivoNota,
  SemillaComprobante,
  TipoComprobante,
  TipoDocIdentidad,
  TipoOperacion,
} from './invoiceDemoSchema';

/**
 * Deriva el tipo de documento del cliente (Catálogo 06) a partir del número.
 *
 * El RUC peruano tiene 11 dígitos y el DNI 8; cualquier otro largo se trata
 * como documento de identidad genérico (DNI) para no romper el XML.
 */
export const tipoDocDesdeNumero = (documento: string): TipoDocIdentidad =>
  documento.length === 11 ? '6' : '1';

/** Construye un comprobante derivando IGV, detracción, retención y neto. */
export function construir(semilla: SemillaComprobante): ComprobanteDemo {
  const afectacion = semilla.afectacion ?? 'GRAVADA';
  const igv = afectacion === 'GRAVADA' ? igvDesdeBase(semilla.base) : 0;
  const total = round2(semilla.base + igv);
  const detraccion = semilla.detraccionPct
    ? calcularDetraccion(total, semilla.detraccionPct)
    : 0;
  const retencion = semilla.agenteRetencion
    ? calcularRetencion(total, true)
    : 0;
  const tipoOperacion: TipoOperacion =
    semilla.tipoOperacion ??
    (semilla.detraccionPct && semilla.detraccionPct > 0 ? '1001' : '0101');
  const formaPago: FormaPago = semilla.formaPago ?? 'Contado';
  const totalNeto = round2(total - detraccion - retencion);
  const cuotas =
    formaPago === 'Credito'
      ? construirCuotas(totalNeto, semilla.numeroCuotas ?? 2, semilla.fecha)
      : [];

  const items: readonly ItemDemo[] =
    semilla.items && semilla.items.length > 0
      ? semilla.items
      : itemsPorDefecto(
          semilla.serie,
          semilla.correlativo,
          semilla.base,
          afectacion,
        );

  return {
    id: `${semilla.serie}-${semilla.correlativo}`,
    // Número fiscal completo, con los ceros de relleno que exige SUNAT. El `id`
    // de los datos demo omite los ceros (F001-43) y NO sirve como identidad
    // fiscal: `numero` es lo que se compara al buscar el origen de una nota.
    numero: `${semilla.serie}-${String(semilla.correlativo).padStart(8, '0')}`,
    tipo: semilla.tipo,
    serie: semilla.serie,
    correlativo: semilla.correlativo,
    clienteRuc: semilla.ruc,
    clienteTipoDoc: semilla.tipoDocCliente ?? tipoDocDesdeNumero(semilla.ruc),
    clienteRazonSocial: semilla.razonSocial,
    fechaEmision: semilla.fecha,
    moneda: 'PEN',
    baseImponible: round2(semilla.base),
    igv,
    detraccion,
    retencion,
    totalNeto,
    estado: semilla.estado,
    cdrCodigo: semilla.cdrCodigo,
    documentoAfectado: semilla.documentoAfectado,
    tiempoDespachoMs: semilla.tiempoDespachoMs,
    tipoOperacion,
    formaPago,
    cuotas,
    motivoNota: semilla.motivoNota,
    cdrDescripcion: descripcionCdr(semilla.cdrCodigo),
    hashCpe: hashSimulado(
      `${semilla.serie}-${semilla.correlativo}-${semilla.ruc}-${total}`,
    ),
    items,
  };
}

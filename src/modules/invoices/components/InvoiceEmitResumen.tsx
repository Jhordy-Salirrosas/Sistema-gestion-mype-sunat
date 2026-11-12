import { pagoSegunDeposito } from '../lib/invoicePagoPresentacion';
/**
 * Resumen en tiempo real del comprobante que se está emitiendo (M1).
 *
 * Aplica el motor tributario real (`liquidarComprobante`) sobre las LÍNEAS de la
 * grilla (TA-64) y muestra el desglose por afectación, que ahora puede tener
 * gravadas, exoneradas e inafectas a la vez. También muestra el cronograma de
 * cuotas ya repartido y el monto en letras.
 */
import { PageText } from '@/components/ui';
import { calcularRetencion, liquidarComprobante, roundDetraccion } from '../lib/invoiceRetentions';
import { round2 } from '../lib/invoiceTaxes';
import { buscarDetraccion } from '../lib/invoiceDetraccion';
import { calcularFlujo } from '../lib/invoiceFlujoPago';
import { montoEnLetrasSunat } from '../lib/invoiceCreditAndRules';
import { borradorALiquidar, esTipoNota } from '../lib/invoiceEmitDraft';
import type { BorradorEmision } from '../lib/invoiceEmitDraft';
import { liquidarDescuentoGlobal } from '../lib/invoiceDescuentoGlobal';

interface InvoiceEmitResumenProps {
  borrador: BorradorEmision;
}

/** Formatea un monto en soles. */
const soles = (valor: number): string =>
  `S/ ${valor.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Resumen tributario calculado del borrador actual. */
export const InvoiceEmitResumen = ({ borrador }: InvoiceEmitResumenProps) => {
  const esNota = esTipoNota(borrador.tipo);
  const codigo = esNota ? undefined : borrador.codigoDetraccion;
  const porcentaje = codigo ? (buscarDetraccion(codigo)?.porcentaje ?? 0) : 0;

  const liquidacion = liquidarComprobante(borradorALiquidar(borrador), {
    // El ICBPER ya se deriva de cantidadBolsas en cada línea registrada.
    // La cabecera no tiene una segunda fuente de cantidades.
    bolsasPlasticas: 0,
    detraccionPorcentaje: porcentaje,
  });

  // El ICBPER de las líneas se suma al total: no pasa por `liquidarComprobante`
  // porque cada producto declara las bolsas entregadas con él.
  const icbperLineas = borrador.items.reduce(
    (acc, item) => acc + (Number.isFinite(item.icbper) ? item.icbper : 0),
    0,
  );
  const resumenGlobal = liquidarDescuentoGlobal(borrador.items, borrador.descuentoGlobal);
  const importeTotal = resumenGlobal.total;
  const detraccion = calcularFlujo(borrador).detraccion;
  const retencion = calcularRetencion(importeTotal, !esNota && borrador.agenteRetencion);
  const neto = round2(importeTotal - detraccion - retencion);

  return (
    <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
      <PageText variant="label">Resumen calculado</PageText>

      {resumenGlobal.gravado > 0 && (
        <PageText variant="caption">
          Gravada {soles(resumenGlobal.gravado)} · IGV {soles(resumenGlobal.igv)}
        </PageText>
      )}
      {liquidacion.opExonerada > 0 && (
        <PageText variant="caption">
          Exonerada {soles(liquidacion.opExonerada)}
        </PageText>
      )}
      {liquidacion.opInafecta > 0 && (
        <PageText variant="caption">
          Inafecta {soles(liquidacion.opInafecta)}
        </PageText>
      )}
      {liquidacion.opGratuita > 0 && (
        <PageText variant="caption">
          Gratuita {soles(liquidacion.opGratuita)} (no se cobra)
        </PageText>
      )}
      {icbperLineas > 0 && (
        <PageText variant="caption">
          ICBPER {soles(icbperLineas)}
        </PageText>
      )}

      {detraccion > 0 && (
        <PageText variant="caption">
          Detracción SPOT del comprobante {soles(detraccion)}
        </PageText>
      )}
      {detraccion > 0 && (
        <PageText variant="caption">Depósito en el Banco de la Nación {soles(roundDetraccion(detraccion))}</PageText>
      )}
      {retencion > 0 && (
        <PageText variant="caption">
          Retención 3% {soles(retencion)}
        </PageText>
      )}

      {detraccion > 0 && <PageText variant="label">Pago directo al proveedor {soles(pagoSegunDeposito(importeTotal, detraccion, retencion).pagoDirecto)}</PageText>}
      <PageText variant="label">Importe total {soles(importeTotal)}</PageText>
      {neto !== importeTotal && (
        <PageText variant="label">Neto pendiente {soles(neto)}</PageText>
      )}

      {detraccion > 0 && borrador.formaPago === 'Credito' && <PageText variant="caption">El neto fiscal de las cuotas conserva la detracción exacta; el pago directo mostrado usa el depósito BN redondeado.</PageText>}
      {borrador.cuotas.length > 0 && (
        <PageText variant="caption">
          {borrador.cuotas
            .map(
              (q, i) =>
                `Cuota${String(i + 1).padStart(3, '0')}: ${soles(q.monto)}`,
            )
            .join(' · ')}
        </PageText>
      )}

      <PageText variant="caption">{montoEnLetrasSunat(importeTotal)}</PageText>
    </div>
  );
};

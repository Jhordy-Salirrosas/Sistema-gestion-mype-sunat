/**
 * Editor del cronograma de cuotas al crédito (TA-64).
 *
 * Antes el formulario solo pedía "Número de cuotas" (1, 2 o 3) y las fechas se
 * calculaban solas cada 30 días. En la práctica el cliente negocia otras fechas
 * —"la primera a 15 días, la segunda a 90"— y un crédito a 6 o 12 cuotas no se
 * podía emitir desde la pantalla.
 *
 * El editor muestra el neto pendiente, reparte el neto en partes iguales por
 * defecto y deja editar importe y fecha. El estado de la regla 3319 se ve en
 * vivo: si el usuario descuadra el cronograma, el botón de emitir se bloquea
 * con el motivo exacto en lugar de dejar que el backend lo rechace.
 */
import { useState } from 'react';
import { Button, PageText } from '@/components/ui';
import {
  repartirEnCuotas,
  validarCronograma,
  type CuotaBorrador,
} from '../lib/invoiceDetraccion';

const CLASE_CELDA =
  'h-8 w-full rounded border bg-background px-2 text-xs text-foreground';

interface CreditInstallmentsEditorProps {
  cuotas: readonly CuotaBorrador[];
  netoPendiente: number;
  fechaEmision: string;
  onCambiar: (cuotas: readonly CuotaBorrador[]) => void;
}

/**
 * Redondeo a céntimos, aplicado EN EL ORIGEN del dato.
 *
 * `repartirEnCuotas` ya redondea lo que calcula, pero cuando el usuario teclea
 * un importe el `<input type="number">` puede entregar un flotante arrastrado
 * (`11.800000190734863`) y ese valor viajaba tal cual al payload. La regla 3319
 * exige que la suma de las cuotas sea EXACTAMENTE el neto pendiente y no admite
 * tolerancia, así que el estado tiene que guardar céntimos limpios y no solo
 * pintarlos limpios: un `toFixed` en el `value` arregla la vista y deja la
 * basura dentro.
 *
 * `+ Number.EPSILON` compensa el caso clásico `1.005 → 1.00` de IEEE-754.
 */
const aCentimos = (valor: number): number =>
  Number.isFinite(valor) ? Math.round((valor + Number.EPSILON) * 100) / 100 : 0;

/** Conserva el texto mientras se escribe; redondea al guardar el valor numérico. */
const ImporteEditable = ({ monto, etiqueta, onChange }: { monto: number; etiqueta: string; onChange: (valor: number) => void }) => {
  const [texto, setTexto] = useState<string | null>(null);
  return <input aria-label={etiqueta} type="text" inputMode="decimal"
    className={`${CLASE_CELDA} text-right`}
    value={texto ?? (Number.isFinite(monto) ? monto.toFixed(2) : '')}
    onFocus={(e) => { setTexto(e.currentTarget.value); e.currentTarget.select(); }}
    onChange={(e) => { const valor = e.target.value; if (!/^\d*(?:\.\d{0,2})?$/.test(valor)) return; setTexto(valor); onChange(valor === '' ? 0 : Number(valor)); }}
    onBlur={() => setTexto(null)} />;
};

/** Tabla editable de cuotas con la comprobación de la regla 3319 al pie. */
export const CreditInstallmentsEditor = ({
  cuotas,
  netoPendiente,
  fechaEmision,
  onCambiar,
}: CreditInstallmentsEditorProps) => {
  const resultado = validarCronograma(cuotas, netoPendiente, fechaEmision);

  /** Vuelve a repartir el neto en el número de cuotas indicado. */
  const repartir = (numero: number) => {
    const nuevas = repartirEnCuotas(netoPendiente, numero, fechaEmision);
    onCambiar(nuevas.map((c) => ({ monto: c.monto, vencimiento: c.vencimiento })));
  };

  const editar = (indice: number, parcial: Partial<CuotaBorrador>) => {
    // El importe se redondea aquí, al entrar: si se guarda el valor crudo del
    // input, la suma de las cuotas deja de cuadrar al céntimo con el neto.
    const limpio =
      parcial.monto === undefined
        ? parcial
        : { ...parcial, monto: aCentimos(parcial.monto) };

    onCambiar(cuotas.map((c, i) => (i === indice ? { ...c, ...limpio } : c)));
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <PageText variant="caption">Pago a crédito en {cuotas.length} {cuotas.length === 1 ? 'cuota' : 'cuotas'} · Neto pendiente S/ {netoPendiente.toFixed(2)}</PageText>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageText variant="label">Cronograma de cuotas</PageText>
        <div className="flex gap-1">
          {[1, 2, 3, 6, 12].map((n) => (
            <Button
              key={n}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => repartir(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-[11px] uppercase">
            <tr>
              <th className="px-2 py-1 text-left">Cuota</th>
              <th className="px-2 py-1 text-right">Importe</th>
              <th className="px-2 py-1 text-left">Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((cuota, i) => (
              <tr key={`cuota-${i}`} className="border-t">
                <td className="px-2 py-1 tabular-nums">
                  Cuota{String(i + 1).padStart(3, '0')}
                </td>
                <td className="px-1 py-1">
                  <ImporteEditable
                    key={i}
                    etiqueta={`Importe de la cuota ${i + 1}`}
                    monto={cuota.monto}
                    onChange={(monto) => editar(i, { monto })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    aria-label={`Vencimiento de la cuota ${i + 1}`}
                    type="date"
                    className={CLASE_CELDA}
                    value={cuota.vencimiento}
                    onChange={(e) =>
                      editar(i, { vencimiento: e.target.value })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PageText variant="caption">
        Neto pendiente {resultado.netoPendiente.toFixed(2)} · cuotas suman{' '}
        {resultado.suma.toFixed(2)}
      </PageText>

      {resultado.cuadra && resultado.errores.length === 0 ? (
        <PageText variant="caption">
          El cronograma cuadra al céntimo con el neto pendiente.
        </PageText>
      ) : (
        resultado.errores.map((error) => (
          <PageText key={error} variant="error">
            · {error}
          </PageText>
        ))
      )}
    </div>
  );
};

/**
 * Campos tributarios del formulario de emisión (TA-64).
 *
 * Agrupa la detracción SPOT del Catálogo 54 y el ICBPER. La afectación IGV ya
 * NO es un campo global: cada línea de la grilla declara la suya. La forma de
 * pago y el cronograma los edita `iCreditInstallmentsEditor` y los botones de
 * forma de pago viven aquí.
 *
 * TA-64 corrige además un defecto real: la detracción se elegía como un
 * PORCENTAJE suelto (4 %, 10 %, 12 %). SUNAT no acepta un porcentaje, pide un
 * código del Catálogo 54; con un porcentaje sin código el XML no se podía
 * armar, y con esos mismos porcentajes no se distinguía flete de servicios.
 */
import {
  PageField,
  PageText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import {
  CODIGOS_DETRACCION,
  esDetraccionDadaDeBaja,
} from '../lib/invoiceDetraccion';
import { detraccionConDescuento } from '../lib/invoiceDetraccionGlobal';
import type { BorradorEmision } from '../lib/invoiceEmitDraft';

interface InvoiceEmitCamposTributariosProps {
  borrador: BorradorEmision;
  actualizar: (parcial: Partial<BorradorEmision>) => void;
  /** Total del comprobante, para estimar la detracción y avisar del umbral. */
  total: number;
}

/** Campos tributarios: detracción SPOT e ICBPER. */
export const InvoiceEmitCamposTributarios = ({
  borrador: b,
  actualizar,
}: InvoiceEmitCamposTributariosProps) => {
  const detraccion = detraccionConDescuento(b.items, b.descuentoGlobal ?? null);
  const dadaDeBaja = b.codigoDetraccion
    ? esDetraccionDadaDeBaja(b.codigoDetraccion)
    : false;

  return (
    <>
      <PageField label="Código de detracción para todas las líneas (Catálogo 54)" htmlFor="detrac">
        <Select
          value={b.codigoDetraccion || '00'}
          onValueChange={(v) =>
            actualizar({ codigoDetraccion: v === '00' ? '' : v })
          }
        >
          <SelectTrigger id="detrac">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="00">Sin detracción SPOT</SelectItem>
            {CODIGOS_DETRACCION.filter(d => d.codigo === '009').map((d) => (
              <SelectItem key={d.codigo} value={d.codigo}>
                {d.codigo} - {d.descripcion} ({d.porcentaje * 100}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {b.codigoDetraccion && (
          <PageText variant="caption">
            {detraccion.aplica
              ? `Detracción estimada: S/ ${detraccion.monto.toFixed(2)}`
              : detraccion.motivoNoAplica}
          </PageText>
        )}
        {dadaDeBaja && (
          <PageText variant="error">
            Ese código fue dado de baja por SUNAT: elija uno vigente.
          </PageText>
        )}
      </PageField>

      <PageField label="Bolsas plásticas ICBPER" htmlFor="bolsas">
        <input
          id="bolsas"
          type="number"
          min="0"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={b.bolsas}
          onChange={(e) => actualizar({ bolsas: Number(e.target.value) || 0 })}
        />
        <PageText variant="caption">
          S/ 0.50 por bolsa. Añádalas con «+ Bolsa plástica» para que viajen como
          línea propia (regla 3306).
        </PageText>
      </PageField>
    </>
  );
};

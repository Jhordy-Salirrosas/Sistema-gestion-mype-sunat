/**
 * Menú desplegable para elegir el tipo de comprobante a emitir.
 *
 * Se separa de `InvoiceFiltersBar` para respetar el límite de líneas.
 */
import { Button } from '@/components/ui';
import { FilePlus } from 'lucide-react';

/** Tipos de comprobante que se pueden emitir desde la barra. */
export type TipoEmision = 'Factura' | 'Boleta' | 'Nota';

const OPCIONES: readonly TipoEmision[] = ['Factura', 'Boleta', 'Nota'];

interface InvoiceEmitMenuProps {
  abierto: boolean;
  onToggle: () => void;
  onEmitir: (tipo: TipoEmision) => void;
}

export const InvoiceEmitMenu = ({
  abierto,
  onToggle,
  onEmitir,
}: InvoiceEmitMenuProps) => {
  return (
    <div className="relative">
      <Button
        size="sm"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-haspopup="menu"
      >
        <FilePlus aria-hidden="true" />
        Emitir Comprobante
      </Button>

      {abierto && (
        <div
          role="menu"
          aria-label="Tipo de comprobante a emitir"
          className="absolute right-0 z-50 mt-1 w-44 rounded-lg border bg-popover p-1 shadow-md"
        >
          {OPCIONES.map((tipo) => (
            <Button
              key={tipo}
              variant="ghost"
              size="sm"
              role="menuitem"
              className="w-full justify-start"
              onClick={() => onEmitir(tipo)}
            >
              {tipo}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Badge semafórico del estado de un comprobante frente a SUNAT.
 *
 * Semántica de color exigida por el módulo M1:
 *  - Verde   -> Aceptado (CDR código 0).
 *  - Amarillo-> Observado (CDR 4xxx: aceptado con observaciones).
 *  - Azul    -> En cola Outbox, pendiente de despacho.
 *  - Ámbar   -> Sin confirmar: el envío falló y SUNAT no lo evaluó.
 *  - Rojo    -> Rechazado por SUNAT (requiere acción correctiva).
 *
 * POR QUÉ "SIN CONFIRMAR" ES UN ESTADO Y NO UN CASO ESPECIAL
 *
 * Antes `mapEstadoCdr` colapsaba un ERROR_RED dentro de RECHAZADO, y este
 * componente tenía que recibir el comprobante entero solo para no rotularlo
 * mal: la excepción vivía fuera del estado. Desde que `SIN_CONFIRMAR` existe en
 * `EstadoCdrDemo`, el estado se basta a sí mismo y esta excepción desaparece.
 *
 * Si algún día se recibe el comprobante completo, no molesta: la propiedad se
 * acepta pero ya no decide nada.
 */
import { Badge } from '@/components/ui';
import type { EstadoCdrDemo } from '../data/invoiceDemoSchema';

/** Metadatos visuales de cada estado. */
const ESTADOS: Record<
  EstadoCdrDemo,
  { label: string; className: string; ariaLabel: string }
> = {
  ACEPTADO: {
    label: 'Aceptado',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
    ariaLabel: 'Aceptado por SUNAT',
  },
  OBSERVADO: {
    label: 'Observado',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
    ariaLabel: 'Aceptado con observaciones de SUNAT',
  },
  EN_COLA: {
    label: 'En cola Outbox',
    className: 'border-blue-500/40 bg-blue-500/10 text-blue-700',
    ariaLabel: 'Pendiente de envio en la cola Outbox',
  },
  /**
   * Ámbar y no rojo: no hay veredicto de SUNAT. El comprobante puede seguir
   * emitiéndose una vez resuelto el problema de red.
   */
  SIN_CONFIRMAR: {
    label: 'Error de red (ERROR_RED)',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
    ariaLabel: 'No llegó a SUNAT: el envío falló por un error de red',
  },
  RECHAZADO: {
    label: 'Rechazado',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
    ariaLabel: 'Rechazado por SUNAT',
  },
};

interface InvoiceStatusBadgeProps {
  estado: EstadoCdrDemo;
  codigo?: string;
}

export const InvoiceStatusBadge = ({ estado, codigo }: InvoiceStatusBadgeProps) => {
  const meta = ESTADOS[estado];

  return (
    <Badge
      variant="outline"
      className={`font-medium ${meta.className}`}
      aria-label={meta.ariaLabel}
    >
      {meta.label}
      {codigo && codigo !== '0' ? ` · ${codigo}` : ''}
    </Badge>
  );
};

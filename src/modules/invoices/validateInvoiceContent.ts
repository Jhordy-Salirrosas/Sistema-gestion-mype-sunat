import { BadRequestException } from '@nestjs/common';
import { asegurarTipoUbl } from './ublTipoGuard';
import type { InvoicePayload } from './invoicePayload';

/** Contenido obligatorio independiente del correlativo todavía no reservado. */
export function validarContenidoFiscal(payload: InvoicePayload): void {
  if (!payload) {
    throw new BadRequestException('El payload del comprobante es obligatorio');
  }

  const requeridos = [
    'rucEmisor',
    'razonSocialEmisor',
    'tipoComprobante',
    'serie',
    'fechaEmision',
    'tipoMoneda',
    'tipoOperacion',
  ] as const;
  for (const campo of requeridos)
    if (typeof payload[campo] !== 'string' || !payload[campo]!.trim()) {
      throw new BadRequestException(`Dato fiscal ausente: ${campo}`);
    }
  const tipo = payload.tipoComprobante;
  if (
    ['01', '03'].includes(tipo) &&
    !['Contado', 'Credito'].includes(payload.formaPago as string)
  )
    throw new BadRequestException('Forma de pago fiscal ausente');
  if (
    ['07', '08'].includes(tipo) &&
    (
      [
        'documentoAfectado',
        'codigoMotivoNota',
        'descripcionMotivoNota',
      ] as const
    ).some(
      (campo) => typeof payload[campo] !== 'string' || !payload[campo]!.trim(),
    )
  )
    throw new BadRequestException('Referencia y motivo de nota obligatorios');

  asegurarTipoUbl(tipo);
}

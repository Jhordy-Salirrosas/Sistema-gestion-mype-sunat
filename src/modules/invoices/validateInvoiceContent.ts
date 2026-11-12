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
  validarLongitudesFiscales(payload);

}

/** Máximos de los nodos serializados según el juego oficial SFS 2.X. */
function validarLongitudesFiscales(payload: InvoicePayload): void {
  const maximo = (campo: string, valor: string | undefined, limite: number) => {
    if (valor !== undefined && Array.from(valor).length > limite) {
      throw new BadRequestException(`El campo ${campo} admite como máximo ${limite} caracteres`);
    }
  };
  maximo('razonSocialEmisor', payload.razonSocialEmisor, 1500);
  maximo('nombreComercialEmisor', payload.nombreComercialEmisor, 1500);
  maximo('cliente.razonSocial', payload.cliente?.razonSocial, 1500);
  maximo('direccionEmisor', payload.direccionEmisor, 200);
  if (payload.direccionEmisor) {
    maximo('provinciaEmisor', payload.provinciaEmisor, 30);
    maximo('departamentoEmisor', payload.departamentoEmisor, 30);
    maximo('distritoEmisor', payload.distritoEmisor, 30);
  }
  maximo('ordenCompra', payload.ordenCompra, 20);
  if (['07', '08'].includes(payload.tipoComprobante)) {
    maximo('descripcionMotivoNota', payload.descripcionMotivoNota, 500);
  }
  const lineas = payload.lineas ?? (payload.linea ? [payload.linea] : []);
  lineas.forEach((linea, i) => maximo(`lineas[${i}].descripcion`, linea.descripcion, 500));
}

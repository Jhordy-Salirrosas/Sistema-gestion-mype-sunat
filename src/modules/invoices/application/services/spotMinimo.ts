import { BadRequestException } from '@nestjs/common';
import type { EmitirComprobanteDto } from '../dto/emitirComprobanteDto';

/** Alcance aprobado: factura PEN, arena/piedra; nunca inferir desde el SKU. */
export function validarClasificacionSpot(dto: EmitirComprobanteDto): void {
  if (!dto.items.some(l => Boolean(l.codigoDetraccion))) return;
  if (dto.tipo_comprobante !== '01' || dto.items.some(l => l.codigoDetraccion !== '009' || l.afectacion !== '10')) {
    throw new BadRequestException('SPOT habilitado solo para factura PEN de arena y piedra (009), con todas las líneas gravadas y clasificadas; operaciones mixtas y otros regímenes no habilitados.');
  }
}

export function validarCuentaSpot(dto: EmitirComprobanteDto, importe: number, cuenta: string | null | undefined): string | null {
  if (!(importe > 0)) return null;
  if (!['001', '003'].includes(dto.medio_pago_detraccion ?? '')) throw new BadRequestException('SPOT requiere medio de pago explícito 001 o 003; no se presume 999.');
  const efectiva = cuenta?.trim();
  if (!efectiva) throw new BadRequestException('SPOT bloqueado: falta la cuenta del Banco de la Nación en la configuración de la empresa.');
  if (dto.cuenta_banco_nacion?.trim() && dto.cuenta_banco_nacion.trim() !== efectiva) throw new BadRequestException('La cuenta BN debe coincidir con la configurada en la empresa.');
  return efectiva;
}

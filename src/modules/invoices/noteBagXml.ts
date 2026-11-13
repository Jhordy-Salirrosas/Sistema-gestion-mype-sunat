import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/client/client';
import type { InvoicePayload } from './invoicePayload';
import {
  conReferenciaGratuitaXml,
  referenciaGratuita,
} from './freeOperationReference';
import { redondearMoneda } from './money';

/** Se ejecuta antes de reservar número y también al regenerar XML histórico. */
export function validarBolsasNota(cantidad: number, bolsas: number): void {
  if (bolsas > cantidad)
    throw new BadRequestException({
      code: 'BOLSAS_NOTA_SUPERAN_CANTIDAD',
      message:
        'Las bolsas de una línea de la nota no pueden superar la cantidad de la línea. Ajuste las bolsas o la cantidad.',
    });
}

/** La XSL 3236 de NC/ND compara las bolsas con round(cantidad), para cualquier afectación. */
export function separarBolsasNota(payload: InvoicePayload): InvoicePayload {
  if (payload.tipoComprobante !== '07' && payload.tipoComprobante !== '08')
    return payload;
  const lineas = payload.lineas ?? (payload.linea ? [payload.linea] : []);
  if (!lineas.some((linea) => (linea.icbperLinea ?? 0) > 0)) return payload;
  const partidas = lineas.flatMap((linea) => {
    if (!((linea.icbperLinea ?? 0) > 0)) return [linea];
    const bolsas = linea.cantidadBolsas ?? linea.icbperLinea! * 2;
    validarBolsasNota(linea.cantidad, bolsas);
    if (bolsas === Math.round(linea.cantidad))
      return [{ ...linea, cantidadBolsas: bolsas }];
    const resto = new Prisma.Decimal(linea.cantidad).minus(bolsas).toNumber();
    const parte = (monto: number) =>
      new Prisma.Decimal(monto)
        .times(bolsas)
        .div(linea.cantidad)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        .toNumber();
    const neto = redondearMoneda(linea.totalLinea - linea.igvLinea);
    const base = parte(neto),
      igv = parte(linea.igvLinea);
    const descuentos = linea.descuentos?.map((d) => ({
      ...d,
      monto: parte(d.monto),
    }));
    const referencia = referenciaGratuita(linea);
    const baseReferencial = parte(referencia.base),
      igvReferencial = parte(referencia.igv);
    return [
      conReferenciaGratuitaXml(
        {
          ...linea,
          cantidad: bolsas,
          cantidadBolsas: bolsas,
          totalLinea: redondearMoneda(base + igv),
          igvLinea: igv,
          descuentos,
        },
        { base: baseReferencial, igv: igvReferencial },
      ),
      conReferenciaGratuitaXml(
        {
          ...linea,
          cantidad: resto,
          cantidadBolsas: undefined,
          icbperLinea: undefined,
          totalLinea: redondearMoneda(linea.totalLinea - base - igv),
          igvLinea: redondearMoneda(linea.igvLinea - igv),
          descuentos: linea.descuentos?.map((d, i) => ({
            ...d,
            monto: redondearMoneda(d.monto - descuentos![i].monto),
          })),
        },
        {
          base: redondearMoneda(referencia.base - baseReferencial),
          igv: redondearMoneda(referencia.igv - igvReferencial),
        },
      ),
    ];
  });
  return {
    ...payload,
    linea: undefined,
    lineas: partidas.map((linea, i) => ({ ...linea, id: i + 1 })),
  };
}

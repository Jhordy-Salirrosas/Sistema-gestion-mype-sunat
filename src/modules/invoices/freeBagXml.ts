import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/client/client';
import { esDocumentoIntegramenteGratuito } from './freeInvoicePolicy';
import { conReferenciaGratuitaXml, referenciaGratuita } from './freeOperationReference';
import { redondearMoneda } from './money';
import type { InvoicePayload } from './invoicePayload';

/** Misma guarda para creación y defensa al regenerar un payload histórico. */
export function validarBolsasGratuitas(cantidad: number, bolsas: number): void {
  if (bolsas > cantidad) throw new BadRequestException({
    code: 'BOLSAS_GRATUITAS_SUPERAN_CANTIDAD',
    message: 'Las bolsas de una línea gratuita no pueden superar la cantidad de la línea. Ajuste las bolsas o la cantidad.',
  });
}

/** Partición exclusiva del XML íntegramente gratuito; el payload guardado permanece intacto. */
export function separarBolsasGratuitas(payload: InvoicePayload): InvoicePayload {
  if (payload.tipoComprobante !== '01') return payload;
  const lineas = payload.lineas ?? (payload.linea ? [payload.linea] : []);
  if (!esDocumentoIntegramenteGratuito(payload.tipoComprobante, lineas)) return payload;
  if (!lineas.some(l => (l.icbperLinea ?? 0) > 0)) return payload;
  const partidas = lineas.flatMap(linea => {
    const bolsas = linea.cantidadBolsas ?? (linea.icbperLinea ?? 0) * 2;
    if (!(bolsas > 0)) return [linea];
    validarBolsasGratuitas(linea.cantidad, bolsas);
    const restante = new Prisma.Decimal(linea.cantidad).minus(bolsas).toNumber();
    const conBolsas = { ...linea, cantidad: bolsas, cantidadBolsas: bolsas };
    if (restante === 0) return [conBolsas];
    const original = referenciaGratuita(linea);
    const referencia = referenciaGratuita(conBolsas);
    return [conReferenciaGratuitaXml(conBolsas, referencia),
      conReferenciaGratuitaXml({ ...linea, cantidad: restante, cantidadBolsas: undefined, icbperLinea: undefined }, {
        base: redondearMoneda(original.base - referencia.base),
        igv: redondearMoneda(original.igv - referencia.igv),
      })];
  });
  return { ...payload, linea: undefined, lineas: partidas.map((linea, i) => ({ ...linea, id: i + 1 })) };
}

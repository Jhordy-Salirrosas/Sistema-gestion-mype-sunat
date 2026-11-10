import { BadRequestException } from '@nestjs/common';
import type { InvoicePayload } from '../../invoicePayload';
import { esAfectacionGratuita, tributoDeAfectacion } from '../../sunatCatalogsQuery';
import { redondearMoneda as r2 } from '../../money';
import { aplicarDescuentoGlobal } from './descuentoGlobal';
export interface SummaryTax { codigo: string; base: number; impuesto: number; }
export interface SummaryFiscal { pagos: { codigo: string; monto: number }[]; tributos: SummaryTax[]; descuento: number; }
/** No se infiere afectación a partir del total/IGV: sin detalle fiscal, se bloquea. */
export function fiscalResumen(raw: unknown, total: number): SummaryFiscal {
  const p = raw as InvoicePayload | null;
  const lines = p?.lineas ?? (p?.linea ? [p.linea] : []);
  if (!lines.length || (p?.tipoMoneda && p.tipoMoneda !== 'PEN')) throw new BadRequestException('RC requiere detalle fiscal persistido y moneda PEN');
  const groups = new Map<string, SummaryTax>();
  let free = 0;
  for (const l of lines) {
    const scheme = typeof l.afectacion === 'string' ? tributoDeAfectacion(l.afectacion) : null;
    if (!scheme) throw new BadRequestException('RC: afectación fiscal ausente o desconocida');
    const gratuita = esAfectacionGratuita(l.afectacion);
    const base = gratuita ? r2(l.cantidad * l.valorUnitario) : r2(l.totalLinea - l.igvLinea);
    const tax = gratuita ? (l.afectacion.startsWith('1') ? r2(base * .18) : 0) : l.igvLinea;
    if (![base, tax, l.icbperLinea ?? 0].every(n => Number.isFinite(n) && n >= 0)) throw new BadRequestException('RC: importes fiscales inválidos');
    const code = gratuita ? '9996' : scheme;
    const g = groups.get(code) ?? { codigo: code, base: 0, impuesto: 0 };
    g.base = r2(g.base + base); g.impuesto = r2(g.impuesto + tax); groups.set(code, g);
    if (gratuita) free = r2(free + base);
    if ((l.icbperLinea ?? 0) > 0) {
      const b = groups.get('7152') ?? { codigo: '7152', base: 0, impuesto: 0 };
      b.impuesto = r2(b.impuesto + l.icbperLinea!); groups.set('7152', b);
    }
  }
  const result = aplicarDescuentoGlobal({ gravado: groups.get('1000')?.base ?? 0, igv: groups.get('1000')?.impuesto ?? 0, exonerado: groups.get('9997')?.base ?? 0, inafecto: groups.get('9998')?.base ?? 0, exportado: groups.get('9995')?.base ?? 0, icbper: groups.get('7152')?.impuesto ?? 0 }, p?.descuentoGlobal, lines.flatMap(l => l.descuentos ?? []).filter(d => d.codigo === '01').reduce((sum, d) => sum + d.monto, 0));
  if (!Number.isFinite(total) || !Number.isFinite(result.total) || Math.abs(result.total - total) > .011) throw new BadRequestException('RC: detalle fiscal no concuerda con el total persistido');
  // La hoja RC exige un TaxTotal IGV aun cuando sea cero; no cambia Catálogo 11.
  groups.set('1000', { codigo: '1000', base: result.bases.gravado, impuesto: result.bases.igv });
  return { pagos: [ ['01', result.bases.gravado], ['02', result.bases.exonerado], ['03', result.bases.inafecto], ['04', result.bases.exportado], ['05', free] ].filter(([, monto]) => Number(monto) > 0).map(([codigo, monto]) => ({ codigo: String(codigo), monto: Number(monto) })), tributos: [...groups.values()], descuento: result.otrosDescuentos };
}

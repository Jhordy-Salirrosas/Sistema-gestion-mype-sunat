import { createHash } from 'node:crypto';
import { fiscal8d, issuer8d } from '../../fixtures/8dFiscalHarness';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
const generator = new UblGeneratorService();
import hashes from '../../fixtures/notas-icbper-unchanged-hashes.json';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { XsdValidatorService } from '../../../src/modules/invoices/xsdValidatorService';
import { InvoiceDownloadService } from '../../../src/modules/invoices/application/services/invoiceDownloadService';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import {
  separarBolsasNota,
  validarBolsasNota,
} from '../../../src/modules/invoices/noteBagXml';
import { referenciaGratuita } from '../../../src/modules/invoices/freeOperationReference';
import { DOMParser } from '@xmldom/xmldom';
function workerXml(payload: object): string {
  const worker = Object.create(InvoiceJobConsumer.prototype);
  worker.ublGenerator = generator;
  worker.xsdValidator = new XsdValidatorService();
  return worker.xmlDelComprobante({ id: 'nota-local', payload_ubl: payload });
}
it.each(hashes)(
  '$type $aff bolsas=$bags mixto=$mixed mantiene el hash previo',
  ({ type, aff, bags, mixed, hash }) => {
    expect(
      createHash('sha256')
        .update(workerXml(fiscal8d(aff, bags, type, mixed).payload))
        .digest('hex'),
    ).toBe(hash);
  },
);
it.each([
  ['NC gravada', '07', '10', 2, 1],
  ['NC gratuita', '07', '21', 2, 1],
  ['NC parcial', '07', '10', 1, 1],
  ['ND gravada', '08', '10', 2, 1],
  ['NC gratuita b=q', '07', '21', 2, 2],
  ['ND gratuita', '08', '11', 2, 1],
  ['NC exonerada', '07', '20', 2, 1],
  ['NC dos gratuitas', '07', '21', 3, 1],
] as const)(
  '%s: adapter → worker → firma → hojas oficiales, descarga idéntica',
  async (_name, type, aff, q, b) => {
    const gratuita = ['11', '21'].includes(aff);
    const payload = traducirEmision(
      {
        tipo_comprobante: type,
        serie: type === '07' ? 'FC01' : 'FD01',
        fecha_emision: '2026-11-12',
        forma_pago: 'Contado',
        customer_identity_type: '6',
        customer_identity_number: '20100070970',
        customer_legal_name: 'Cliente ficticio',
        documento_afectado: 'F001-00000001',
        codigo_motivo_nota: type === '07' ? (q === 1 ? '07' : '06') : '02',
        items: Array.from({ length: q === 3 ? 2 : 1 }, (_, i) => ({
          codigo: `MAT-${i}`,
          descripcion: 'Bien ficticio',
          unidad: 'NIU',
          cantidad: q,
          valorUnitario: 100,
          precioUnitario: gratuita ? 0 : aff === '10' ? 118 : 100,
          afectacion: aff,
          cantidadBolsas: b,
          icbper: b * 0.5,
        })),
      } as never,
      issuer8d,
      1,
    ).dto
      .payload_ubl as unknown as import('../../../src/modules/invoices/invoicePayload').InvoicePayload;
    const before = JSON.stringify(payload);
    const xml = workerXml(payload);
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    const lineTag = type === '07' ? 'cac:CreditNoteLine' : 'cac:DebitNoteLine';
    const lines = Array.from(parsed.getElementsByTagName(lineTag));
    expect(lines).toHaveLength(q === b ? 1 : q === 3 ? 4 : 2);
    const bagLine = lines[0];
    const subtotals = Array.from(
      bagLine.getElementsByTagName('cac:TaxSubtotal'),
    );
    const bag = subtotals.find(
      (s) => s.getElementsByTagName('cbc:ID').item(1)?.textContent === '7152',
    )!;
    expect(bag).toBeDefined();
    expect(
      bag.getElementsByTagName('cbc:BaseUnitMeasure').item(0)?.textContent,
    ).toBe(String(b));
    expect(
      bag.getElementsByTagName('cbc:PerUnitAmount').item(0)?.parentNode
        ?.nodeName,
    ).toBe('cac:TaxCategory');
    expect(
      bag.getElementsByTagName('cbc:PerUnitAmount').item(0)?.textContent,
    ).toBe('0.50');
    expect(bag.getElementsByTagName('cbc:TaxAmount').item(0)?.textContent).toBe(
      (b * 0.5).toFixed(2),
    );
    const headerSubtotals = Array.from(parsed.documentElement.childNodes)
      .filter((n) => n.nodeName === 'cac:TaxTotal')
      .flatMap((n) =>
        Array.from((n as any).getElementsByTagName('cac:TaxSubtotal')),
      );
    const headerBag = headerSubtotals.find(
      (s) =>
        s
          .getElementsByTagName('cac:TaxScheme')
          .item(0)
          ?.getElementsByTagName('cbc:ID')
          .item(0)?.textContent === '7152',
    )!;
    expect(
      headerBag.getElementsByTagName('cbc:TaxAmount').item(0)?.textContent,
    ).toBe((b * 0.5 * (q === 3 ? 2 : 1)).toFixed(2));
    expect(xml).toContain(
      `<cbc:PayableAmount currencyID="PEN">${Number(payload.montoTotal).toFixed(2)}</cbc:PayableAmount>`,
    );
    const cert = fakeIssuerCertificate();
    const signature = new SignatureService({
      getCertificate: () => ({
        certificatePem: cert.pem,
        privateKeyPem: cert.privateKeyPem,
      }),
    } as never);
    const signed = signature.signXml(xml).signedXml;
    expect(await ejecutarSfs(signed, type)).toEqual({
      completado: true,
      errores: [],
    });
    const download = Object.create(InvoiceDownloadService.prototype);
    download.ublGenerator = generator;
    download.signature = signature;
    download.logger = { warn: jest.fn() };
    expect(
      download.regenerarXmlFirmado({
        id: 'nota-local',
        serie: payload.serie,
        correlativo: 1,
        payload_ubl: payload,
      }),
    ).toBe(signed);
    expect(JSON.stringify(payload)).toBe(before);
  },
);
it('reparte céntimos, descuentos y referencias sin alterar unidades ni totales', () => {
  const payload = fiscal8d('11', 1, '07').payload;
  const l = payload.lineas![0];
  Object.assign(l, {
    cantidad: 3,
    valorUnitario: 0.335,
    totalLinea: 1.01,
    igvLinea: 0.15,
    descuentos: [
      { codigo: '00', monto: 0.01 },
      { codigo: '01', monto: 0.02 },
    ],
  });
  const parts = separarBolsasNota(payload).lineas!;
  expect(parts.reduce((s, p) => s + p.totalLinea, 0)).toBe(1.01);
  expect(parts.reduce((s, p) => s + p.igvLinea, 0)).toBeCloseTo(0.15, 10);
  expect(parts.map((p) => p.valorUnitario)).toEqual([0.335, 0.335]);
  expect(parts.reduce((s, p) => s + referenciaGratuita(p).base, 0)).toBe(
    referenciaGratuita(l).base,
  );
  expect(parts.reduce((s, p) => s + p.descuentos![0].monto, 0)).toBe(0.01);
  expect(parts.reduce((s, p) => s + p.descuentos![1].monto, 0)).toBe(0.02);
  expect(parts.map((p) => p.icbperLinea)).toEqual([0.5, undefined]);
});
it('admite lista ausente, línea singular, líneas sin bolsas y cantidad heredada del impuesto', () => {
  const payload = fiscal8d('10', 1, '07').payload;
  const l = payload.lineas![0];
  delete l.cantidadBolsas;
  const singular = { ...payload, lineas: undefined, linea: l };
  expect(separarBolsasNota(singular).lineas).toHaveLength(2);
  const vacio = { ...singular, linea: undefined };
  expect(separarBolsasNota(vacio)).toBe(vacio);
  l.cantidad = 1;
  expect(separarBolsasNota(singular).lineas![0].cantidadBolsas).toBe(1);
  l.icbperLinea = undefined;
  expect(separarBolsasNota(singular)).toBe(singular);
  const mixta = fiscal8d('10', 1, '08').payload;
  mixta.lineas!.push({ ...l, id: 2 });
  expect(separarBolsasNota(mixta).lineas).toHaveLength(3);
  validarBolsasNota(2, 1);
  expect(() => validarBolsasNota(1, 2)).toThrow(
    'Las bolsas de una línea de la nota',
  );
});

it.each(['07', '08'])(
  'partición %s incluye líneas inafectas, varias líneas y cantidades fraccionarias',
  (type) => {
    const payload = fiscal8d('30', 1, type).payload;
    payload.lineas!.push({ ...payload.lineas![0], cantidad: 2.5, id: 2 });
    const parts = separarBolsasNota(payload).lineas!;
    expect(parts.map((l) => l.cantidad)).toEqual([1, 1, 1, 1.5]);
    expect(parts.reduce((s, l) => s + (l.icbperLinea ?? 0), 0)).toBe(1);
    expect(parts.reduce((s, l) => s + l.totalLinea, 0)).toBe(
      payload.lineas!.reduce((s, l) => s + l.totalLinea, 0),
    );
  },
);

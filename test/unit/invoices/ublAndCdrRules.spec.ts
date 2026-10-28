import {
  CATALOGO_01_TIPO_COMPROBANTE,
  CATALOGO_07_AFECTACION,
  TASA_IGV,
  TASA_RETENCION_IGV,
  UMBRAL_DETRACCION_SOLES,
  descripcionTipoComprobante,
  esAfectacionGravada,
  esExportacion,
  esTipoResumen,
  esTipoUbl,
  porcentajeDetraccion,
  superaUmbralDetraccion,
} from '../../../src/modules/invoices/sunatCatalogs';
import {
  UblGeneratorService,
  type InvoicePayload,
} from '../../../src/modules/invoices/ublGeneratorService';
import { XsdValidatorService } from '../../../src/modules/invoices/xsdValidatorService';
import {
  MENSAJE_SERIE_INVALIDA,
  REGLAS_SERIE,
  serieCorrespondeATipo,
  serieSugerida,
} from '../../../src/modules/invoices/domain/rules/serieRules';

const payloadBase: InvoicePayload = {
  rucEmisor: '20601012341',
  razonSocialEmisor: 'MYPE CONFECCIONES INDUSTRIALES S.A.C.',
  tipoComprobante: '01',
  serie: 'F001',
  numero: 42,
  fechaEmision: '2026-10-20',
  tipoMoneda: 'PEN',
  cliente: {
    tipoDocumento: '6',
    numeroDocumento: '20100070970',
    razonSocial: 'CORPORACIÓN TEXTIL DEL NORTE S.A.C.',
  },
  montoGravado: 1000,
  montoIgv: 180,
  montoTotal: 1180,
};

describe('sunatCatalogs - catálogos oficiales de SUNAT', () => {
  it('expone los tipos de comprobante del Catálogo 01', () => {
    expect(CATALOGO_01_TIPO_COMPROBANTE['01']).toBe('Factura');
    expect(CATALOGO_01_TIPO_COMPROBANTE['07']).toBe('Nota de crédito');
    expect(descripcionTipoComprobante('03')).toBe('Boleta de venta');
    expect(descripcionTipoComprobante('99')).toBe('Desconocido');
  });

  it('distingue documentos UBL individuales de los resúmenes', () => {
    expect(esTipoUbl('01')).toBe(true);
    expect(esTipoUbl('07')).toBe(true);
    expect(esTipoUbl('RA')).toBe(false);
    expect(esTipoResumen('RC')).toBe(true);
  });

  it('clasifica correctamente los códigos de afectación del Catálogo 07', () => {
    expect(esAfectacionGravada('10')).toBe(true);
    expect(esAfectacionGravada('20')).toBe(false);
    expect(esExportacion('40')).toBe(true);
    expect(CATALOGO_07_AFECTACION['20']).toContain('Exonerado');
  });

  it('resuelve el porcentaje de detracción del Catálogo 54 y el umbral SPOT', () => {
    expect(porcentajeDetraccion('012')).toBe(0.12);
    expect(porcentajeDetraccion('027')).toBe(0.04);
    expect(porcentajeDetraccion('999')).toBeNull();
    expect(superaUmbralDetraccion(UMBRAL_DETRACCION_SOLES + 1)).toBe(true);
    expect(superaUmbralDetraccion(UMBRAL_DETRACCION_SOLES)).toBe(false);
  });

  it('declara las tasas vigentes de IGV y retención', () => {
    expect(TASA_IGV).toBe(0.18);
    expect(TASA_RETENCION_IGV).toBe(0.03);
  });
});


describe('UblGeneratorService - generación UBL 2.1', () => {
  let generator: UblGeneratorService;

  beforeEach(() => {
    generator = new UblGeneratorService();
  });

  it('genera una factura con raíz Invoice y nodos obligatorios', () => {
    const xml = generator.generateInvoiceXml(payloadBase);

    expect(xml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:InvoiceTypeCode listID="0101">01</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cbc:ID>F001-00000042</cbc:ID>');
    expect(xml).toContain('<cac:AccountingSupplierParty>');
    expect(xml).toContain('<cac:AccountingCustomerParty>');
    expect(xml).toContain('<cac:LegalMonetaryTotal>');
    expect(xml).toContain('</Invoice>');
  });

  it('usa la raíz CreditNote y referencia el documento afectado en tipo 07', () => {
    const xml = generator.generateInvoiceXml({
      ...payloadBase,
      tipoComprobante: '07',
      serie: 'FC01',
      numero: 7,
      documentoAfectado: 'F001-00000042',
      codigoMotivoNota: '01',
      descripcionMotivoNota: 'Anulación de la operación',
    });

    expect(xml).toContain('<CreditNote');
    expect(xml).toContain('</CreditNote>');
    expect(xml).toContain('<cbc:CreditNoteTypeCode');
    expect(xml).not.toContain('<cbc:InvoiceTypeCode');
    expect(xml).toContain('<cbc:ResponseCode>01</cbc:ResponseCode>');
    expect(xml).toContain('<cbc:ID>F001-00000042</cbc:ID>');
  });

  it('usa la raíz DebitNote en el tipo 08', () => {
    const xml = generator.generateInvoiceXml({
      ...payloadBase,
      tipoComprobante: '08',
      serie: 'FD01',
      numero: 3,
      documentoAfectado: 'F001-00000042',
      codigoMotivoNota: '02',
    });

    expect(xml).toContain('<DebitNote');
    expect(xml).toContain('<cbc:DebitNoteTypeCode');
    expect(xml).toContain('</DebitNote>');
  });

  it('aplica detracción solo si supera el umbral de S/ 700', () => {
    const bajo = generator.calcularTotales({
      ...payloadBase,
      codigoDetraccion: '012',
      montoTotal: 500,
    });
    expect(bajo.detraccion).toBe(0);

    const alto = generator.calcularTotales({
      ...payloadBase,
      codigoDetraccion: '012',
      montoGravado: 1000,
      montoIgv: 180,
      montoTotal: 1180,
    });
    // 12% de 1180 = 141.6 -> redondeado al entero
    expect(alto.detraccion).toBe(142);
  });

  it('redondea la retención del IGV al entero superior', () => {
    expect(generator.calcularRetencion(1180)).toBe(36);
    expect(generator.calcularRetencion(100)).toBe(3);
    expect(generator.calcularRetencion(0)).toBe(0);
  });

  it('calcula el ICBPER por bolsa plástica a S/ 0.50', () => {
    const t = generator.calcularTotales({ ...payloadBase, bolsasIcBper: 4 });

    expect(t.icbper).toBe(2);
    expect(t.total).toBe(1182);
  });

  it('rechaza tipos que no se emiten como documento UBL individual', () => {
    expect(() =>
      generator.generateInvoiceXml({ ...payloadBase, tipoComprobante: 'RA' }),
    ).toThrow(/resumen o comunicación de baja/);
    expect(() =>
      generator.generateInvoiceXml({ ...payloadBase, tipoComprobante: '09' }),
    ).toThrow(/no se emite como documento UBL individual/);
  });

  it('rechaza un payload ausente', () => {
    expect(() =>
      generator.generateInvoiceXml(undefined as unknown as InvoicePayload),
    ).toThrow(/obligatorio/);
  });

  it('emite el cronograma de cuotas cuando la forma de pago es al crédito', () => {
    const xml = generator.generateInvoiceXml({
      ...payloadBase,
      formaPago: 'Credito',
      cuotas: [
        { numero: 'Cuota001', monto: 590, vencimiento: '2026-11-20' },
        { numero: 'Cuota002', monto: 590, vencimiento: '2026-12-20' },
      ],
    });

    expect(xml).toContain('<cbc:PaymentMeansID>Credito</cbc:PaymentMeansID>');
    expect(xml).toContain('<cbc:PaymentMeansID>Cuota</cbc:PaymentMeansID>');
    expect(xml).toContain('<cbc:PaymentDueDate>2026-11-20</cbc:PaymentDueDate>');
  });
});

describe('XsdValidatorService - validación estructural', () => {
  const validator = new XsdValidatorService();
  const generator = new UblGeneratorService();

  it('acepta un XML generado correctamente', () => {
    const xml = generator.generateInvoiceXml(payloadBase);
    const r = validator.validateInvoiceUbl21(xml);

    expect(r.errors).toEqual([]);
    expect(r.isValid).toBe(true);
  });

  it('detecta el tipo de comprobante a partir de la raíz', () => {
    const factura = generator.generateInvoiceXml(payloadBase);
    const nota = generator.generateInvoiceXml({
      ...payloadBase,
      tipoComprobante: '07',
      serie: 'FC01',
      documentoAfectado: 'F001-00000042',
    });

    expect(validator.detectarTipo(factura)).toBe('01');
    expect(validator.detectarTipo(nota)).toBe('07');
  });

  it('rechaza un XML vacío', () => {
    const r = validator.validateInvoiceUbl21('   ');

    expect(r.isValid).toBe(false);
    expect(r.errors[0]).toContain('vacío');
  });

  it('rechaza una raíz desconocida', () => {
    const r = validator.validateInvoiceUbl21('<Boleta><cbc:ID>1</cbc:ID></Boleta>');

    expect(r.isValid).toBe(false);
    expect(r.errors[0]).toContain('elemento raíz');
  });

  it('detecta nodos obligatorios ausentes', () => {
    const xml = '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>F001-1</cbc:ID></Invoice>';
    const r = validator.validateInvoiceUbl21(xml);

    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.includes('cbc:UBLVersionID'))).toBe(true);
  });

  it('exige DiscrepancyResponse y BillingReference solo en notas', () => {
    const xmlFactura = generator
      .generateInvoiceXml(payloadBase)
      .replace(/<cac:DiscrepancyResponse>[\s\S]*?<\/cac:BillingReference>/, '');
    const rFactura = validator.validateInvoiceUbl21(xmlFactura);
    expect(rFactura.errors.some((e) => e.includes('DiscrepancyResponse'))).toBe(false);

    const xmlNota = generator
      .generateInvoiceXml({
        ...payloadBase,
        tipoComprobante: '07',
        serie: 'FC01',
      })
      .replace(/<cac:DiscrepancyResponse>[\s\S]*?<\/cac:BillingReference>/, '');
    const rNota = validator.validateInvoiceUbl21(xmlNota);
    expect(rNota.isValid).toBe(false);
  });

  it('detecta cuando el adquirente es el mismo emisor (error 2022)', () => {
    const xml = generator
      .generateInvoiceXml(payloadBase)
      .replace('20100070970', '20601012341');
    const r = validator.validateInvoiceUbl21(xml);

    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.includes('2022'))).toBe(true);
  });

  it('reporta advertencias sin invalidar el documento', () => {
    const xml = generator.generateInvoiceXml(payloadBase);
    const r = validator.validateInvoiceUbl21(xml);

    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.isValid).toBe(true);
  });
});

describe('serieRules - series por tipo de comprobante', () => {
  it('acepta series de factura y boleta', () => {
    expect(serieCorrespondeATipo('F001', '01')).toBe(true);
    expect(serieCorrespondeATipo('E001', '01')).toBe(true);
    expect(serieCorrespondeATipo('B001', '03')).toBe(true);
    expect(serieCorrespondeATipo('EB01', '03')).toBe(true);
  });

  it('acepta series de nota de crédito y débito', () => {
    expect(serieCorrespondeATipo('FC01', '07')).toBe(true);
    expect(serieCorrespondeATipo('BC01', '07')).toBe(true);
    expect(serieCorrespondeATipo('FD01', '08')).toBe(true);
    expect(serieCorrespondeATipo('BD01', '08')).toBe(true);
  });

  it('rechaza series cruzadas entre tipos', () => {
    expect(serieCorrespondeATipo('FC01', '01')).toBe(false);
    expect(serieCorrespondeATipo('F001', '07')).toBe(false);
    expect(serieCorrespondeATipo('B001', '01')).toBe(false);
  });

  it('rechaza tipos no cubiertos por la tabla', () => {
    expect(serieCorrespondeATipo('F001', 'RA')).toBe(false);
    expect(serieCorrespondeATipo('', '01')).toBe(false);
  });

  it('expone el mensaje y la serie sugerida por tipo', () => {
    expect(REGLAS_SERIE['01'].mensaje).toContain('Facturas');
    expect(serieSugerida('07')).toBe('FC01');
    expect(serieSugerida('RA')).toBe('');
    expect(MENSAJE_SERIE_INVALIDA).toContain('no corresponde');
  });
});

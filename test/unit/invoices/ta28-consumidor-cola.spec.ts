/**
 * TA-28 - Consumidor de la cola de facturas.
 *
 * Lo que se protege aqui es el tramo que NO existia: el job que llega con
 * `{ invoice_id }` se convierte en un envio real a SUNAT. Los casos cubren:
 *
 *  - criterio 1: el job se consume y llega a `processWithRetry`;
 *  - criterio 2: el payload se recarga del comprobante, se firma y se comprime;
 *  - criterio 7: el job no se queda en EN_COLA: sale con estado final o diferido;
 *  - guardas: un job sin invoice_id, un comprobante inexistente o ya en estado
 *    final no deben tocar SUNAT.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import type { RetryInvoiceResult } from '../../../src/modules/resilience/infrastructure/queue/invoiceRetryService';
import { UblGeneratorService, type InvoicePayload } from '../../../src/modules/invoices/ublGeneratorService';
import { payloadMedioPago } from './ta63MedioPagoFixtures';

/** Comprobante base que devuelve el repositorio. */
const COMPROBANTE = {
  id: 'inv-1',
  ruc_emisor: '20601012341',
  tipo_comprobante: '01',
  serie: 'F001',
  correlativo: 1,
  estado: InvoiceStatus.EN_COLA,
  payload_ubl: { rucEmisor: '20601012341', tipoComprobante: '01' },
  xml_storage_url: '<?xml version="1.0"?><Invoice/>',
};

const RESULTADO: RetryInvoiceResult = {
  invoiceId: 'inv-1',
  estado: InvoiceStatus.ACEPTADO,
  intentos: 1,
  reintentable: false,
  enviadoADlq: false,
  circuitoAbierto: false,
  ultimoResultado: null,
  error: null,
};

interface Dobles {
  consumidor: InvoiceJobConsumer;
  registerInvoiceWorker: jest.Mock<
    (handler: (payload: { invoice_id: string }) => Promise<unknown>) => Promise<string>
  >;
  processWithRetry: jest.Mock<
    (params: unknown) => Promise<RetryInvoiceResult>
  >;
  findUnique: jest.Mock<() => Promise<unknown>>;
  update: jest.Mock<(args: unknown) => Promise<unknown>>;
  signXml: jest.Mock<(xml: string) => { signedXml: string }>;
  generateInvoiceXml: jest.Mock<(payload: unknown) => string>;
  validate: jest.Mock<() => { isValid: boolean; errors: string[] }>;
}

function crearDobles(fila: unknown = COMPROBANTE, generadorReal = false): Dobles {
  const registerInvoiceWorker = jest.fn<
    (handler: (payload: { invoice_id: string }) => Promise<unknown>) => Promise<string>
  >(async () => 'worker-1');

  const processWithRetry = jest.fn<(params: unknown) => Promise<RetryInvoiceResult>>(
    async () => RESULTADO,
  );
  const findUnique = jest.fn<() => Promise<unknown>>(async () => fila);
  const update = jest.fn<(args: unknown) => Promise<unknown>>(async () => ({}));
  const signXml = jest.fn<(xml: string) => { signedXml: string }>((xml) => ({
    signedXml: `${xml}<ds:Signature/>`,
  }));
  const generateInvoiceXml = jest.fn<(payload: unknown) => string>(
    (payload) => generadorReal
      ? new UblGeneratorService().generateInvoiceXml(payload as InvoicePayload)
      : '<?xml version="1.0"?><Invoice/>',
  );
  const validate = jest.fn<() => { isValid: boolean; errors: string[] }>(() => ({
    isValid: true,
    errors: [],
  }));

  const registrar = jest.fn<(factura: unknown) => Promise<unknown>>(async () => ({
    movimientosRegistrados: 0,
    movimientosOmitidos: 0,
    asientoOmitido: false,
    errores: [],
    completo: true,
  }));

  const consumidor = new InvoiceJobConsumer(
    { registerInvoiceWorker } as never,
    { processWithRetry } as never,
    { invoice: { findUnique, update } } as never,
    { generateInvoiceXml } as never,
    { validateInvoiceUbl21: validate } as never,
    { signXml } as never,
    // TA-58: el consumidor ahora aplica la compuerta XSL antes de enviar.
    // Aqui se devuelve "valido" para que estas pruebas sigan midiendo lo suyo
    // (recarga del payload, firma y empaquetado) y no la compuerta.
    {
      validar: jest.fn<() => Promise<unknown>>(async () => ({
        valido: true,
        errores: [],
        codigosDesconocidos: [],
        bloqueado: false,
        motivoBloqueo: null,
      })),
    } as never,
    { persistFailure: jest.fn() } as never,
    // TA-68: puente contable. En esta suite es un doble que no hace nada.
    { registrar } as never,
    // Guarda el XML firmado para que la descarga entregue el documento real.
    { guardar: jest.fn(async () => 'hash-de-prueba') } as never,
  );

  return {
    consumidor,
    registerInvoiceWorker,
    processWithRetry,
    findUnique,
    update,
    signXml,
    generateInvoiceXml,
    validate,
  };
}

describe('TA-28 InvoiceJobConsumer', () => {
  it.each([undefined, '003'] as const)('cola genera medio %s desde el payload recargado', async (medio) => {
    const payload = { ...payloadMedioPago(), medioPagoDetraccion: medio };
    const d = crearDobles({ ...COMPROBANTE, payload_ubl: JSON.parse(JSON.stringify(payload)), xml_storage_url: null }, true);
    await d.consumidor.preparar('inv-1');
    expect(d.signXml.mock.calls[0][0]).toContain(
      `<cbc:PaymentMeansCode>${medio ?? '999'}</cbc:PaymentMeansCode>`,
    );
  });

  it.each(['1001', '014', 'sin-detraccion'])('cola bloquea medio inválido %s antes de firmar y enviar', async (medio) => {
    const payload = { ...payloadMedioPago(), medioPagoDetraccion: medio === 'sin-detraccion' ? '001' : medio,
      ...(medio === 'sin-detraccion' ? { montoDetraccion: 0 } : {}) };
    const d = crearDobles({ ...COMPROBANTE, payload_ubl: payload, xml_storage_url: null }, true);
    await expect(d.consumidor.preparar('inv-1')).rejects.toThrow(/Catálogo 59|sin detracción efectiva/);
    expect(d.signXml).not.toHaveBeenCalled();
    expect(d.processWithRetry).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    process.env.CERT_BASE64 = 'certificado-de-prueba';
  });

  it('registra el worker sobre la cola al iniciar el modulo', async () => {
    const d = crearDobles();
    await d.consumidor.onModuleInit();
    expect(d.registerInvoiceWorker).toHaveBeenCalledTimes(1);
  });

  it('descarta un job sin invoice_id sin tocar SUNAT', async () => {
    const d = crearDobles();
    const resultado = await d.consumidor.procesar({ invoice_id: '' });

    expect(resultado).toBeNull();
    expect(d.processWithRetry).not.toHaveBeenCalled();
  });

  it('delega el envio en InvoiceRetryService con los datos del comprobante', async () => {
    const d = crearDobles();
    const resultado = await d.consumidor.procesar({ invoice_id: 'inv-1' });

    expect(resultado).toEqual(RESULTADO);
    expect(d.processWithRetry).toHaveBeenCalledTimes(1);

    const params = d.processWithRetry.mock.calls[0][0] as never as {
      rucEmisor: string;
      tipoComprobante: string;
      serie: string;
      correlativo: number;
      zip: Buffer;
    };
    expect(params.rucEmisor).toBe('20601012341');
    expect(params.tipoComprobante).toBe('01');
    expect(params.serie).toBe('F001');
    expect(params.correlativo).toBe(1);
    expect(Buffer.isBuffer(params.zip)).toBe(true);
  });

  it('empaqueta el XML con el nombre que espera SUNAT', async () => {
    const d = crearDobles();
    const { params } = await d.consumidor.preparar('inv-1');
    const AdmZip = (await import('adm-zip')).default;
    const nombres = new AdmZip(params.zip).getEntries().map((e) => e.entryName);

    expect(nombres).toEqual(['20601012341-01-F001-00000001.xml']);
  });

  it('firma el XML cuando hay certificado configurado', async () => {
    const d = crearDobles();
    await d.consumidor.preparar('inv-1');
    expect(d.signXml).toHaveBeenCalledTimes(1);
  });

  it('no vuelve a firmar un XML que ya trae la firma', async () => {
    const d = crearDobles({
      ...COMPROBANTE,
      xml_storage_url: '<?xml version="1.0"?><Invoice><ds:Signature/></Invoice>',
    });
    const aprobado = await d.consumidor.preparar('inv-1');

    expect(d.signXml).not.toHaveBeenCalled();
    expect(aprobado.firmado).toBe(true);
  });

  it('genera y valida el XML desde payload_ubl si no hay XML guardado', async () => {
    const d = crearDobles({ ...COMPROBANTE, xml_storage_url: null });
    await d.consumidor.preparar('inv-1');

    expect(d.generateInvoiceXml).toHaveBeenCalledTimes(1);
    expect(d.validate).toHaveBeenCalledTimes(1);
  });

  it('rechaza un XML generado que no pasa el XSD', async () => {
    const d = crearDobles({ ...COMPROBANTE, xml_storage_url: null });
    d.validate.mockImplementation(() => ({
      isValid: false,
      errors: ['cbc:ID falta'],
    }));

    await expect(d.consumidor.preparar('inv-1')).rejects.toThrow(/cbc:ID falta/);
  });
  it('no reenvia un comprobante que ya tiene estado final', async () => {
    const d = crearDobles({ ...COMPROBANTE, estado: InvoiceStatus.ACEPTADO });

    await expect(d.consumidor.preparar('inv-1')).rejects.toThrow(
      /estado final ACEPTADO/,
    );
    expect(d.processWithRetry).not.toHaveBeenCalled();
  });

  it('deja ERROR_RED si el comprobante no se puede preparar', async () => {
    const d = crearDobles(null);
    const resultado = await d.consumidor.procesar({ invoice_id: 'inv-1' });

    expect(resultado).toBeNull();
    expect(d.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { estado: InvoiceStatus.ERROR_RED },
      }),
    );
    expect(d.processWithRetry).not.toHaveBeenCalled();
  });

  it('genera el asiento contable cuando el CDR queda aceptado', async () => {
    const accounting = {
      execute: jest.fn<(args: unknown) => Promise<unknown>>(async () => null),
    };
    const FILA_CONTABLE = {
      ...COMPROBANTE,
      company_id: 'company-1',
      fecha_emision: new Date('2026-03-15T00:00:00.000Z'),
      customer_legal_name: 'CLIENTE S.A.C.',
      monto_total: 118,
      total_igv: 18,
      taxable_operations: 100,
    };
    // Tres lecturas en este flujo: `preparar` (envío), el puente de TA-68 y el
    // caso de uso de contabilidad. Se devuelve la fila contable en las tres.
    const findUnique = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(COMPROBANTE)
      .mockResolvedValueOnce(FILA_CONTABLE)
      .mockResolvedValueOnce(FILA_CONTABLE);
    const consumer = new InvoiceJobConsumer(
      { registerInvoiceWorker: jest.fn() } as never,
      { processWithRetry: jest.fn<() => Promise<RetryInvoiceResult>>(async () => RESULTADO) } as never,
      { invoice: { findUnique, update: jest.fn() },
        accountingEntry: { findFirst: jest.fn(async () => null) } } as never,
      { generateInvoiceXml: jest.fn(() => '<?xml version="1.0"?><Invoice/>') } as never,
      { validateInvoiceUbl21: jest.fn(() => ({ isValid: true, errors: [] })) } as never,
      { signXml: jest.fn((xml: string) => ({ signedXml: `${xml}<ds:Signature/>` })) } as never,
      // TA-58: compuerta XSL, aquí siempre "válido".
      {
        validar: jest.fn(async () => ({
          valido: true,
          errores: [],
          codigosDesconocidos: [],
          bloqueado: false,
          motivoBloqueo: null,
        })),
      } as never,
      { persistFailure: jest.fn() } as never,
      // TA-68: el puente no deja asiento (`asientoId: undefined`), que es la
      // condición para que contabilidad tome el relevo con el suyo.
      {
        registrar: jest.fn(async () => ({
          movimientosRegistrados: 0,
          movimientosOmitidos: 0,
          asientoOmitido: false,
          asientoId: undefined,
          errores: [],
          completo: true,
        })),
      } as never,
      { guardar: jest.fn(async () => 'hash-de-prueba') } as never,
      accounting as never,
    );

    await consumer.procesar({ invoice_id: 'inv-1' });

    expect(accounting.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        invoiceId: 'inv-1',
        tipoComprobante: '01',
        base: 100,
        igv: 18,
        total: 118,
      }),
    );
  });

  it.each(['01', '03'] as const)('envía descuento %s al puente y bloquea solo el respaldo incompatible', async (codigo) => {
    const accounting = { execute: jest.fn<() => Promise<unknown>>(async () => null) };
    const registrar = jest.fn<(factura: unknown) => Promise<unknown>>(async () => ({ movimientosRegistrados: 1, movimientosOmitidos: 0, asientoOmitido: true, errores: ['Revisión contable'], completo: false }));
    const payload = { ...COMPROBANTE.payload_ubl, lineas: [{ id: 1, descripcion: 'Servicio', cantidad: 1, valorUnitario: 100, afectacion: '10', totalLinea: 118, igvLinea: 18, descuentos: codigo === '01' ? [{ codigo: '01', monto: 10 }] : [] }], lineasTributarias: [{ afectacion: '10', valorVenta: 100, igv: 18 }], descuentoGlobal: codigo === '03' ? { codigo: '03', monto: 10 } : null };
    const fila = { ...COMPROBANTE, payload_ubl: payload, company_id: 'company-1', fecha_emision: new Date('2026-03-15T00:00:00.000Z'), items: [] };
    const findUnique = jest.fn<() => Promise<unknown>>().mockResolvedValueOnce(COMPROBANTE).mockResolvedValueOnce(fila);
    const consumer = new InvoiceJobConsumer(
      { registerInvoiceWorker: jest.fn() } as never,
      { processWithRetry: jest.fn<() => Promise<RetryInvoiceResult>>(async () => RESULTADO) } as never,
      { invoice: { findUnique, update: jest.fn() } } as never,
      { generateInvoiceXml: jest.fn(() => '<?xml version="1.0"?><Invoice/>') } as never,
      { validateInvoiceUbl21: jest.fn(() => ({ isValid: true, errors: [] })) } as never,
      { signXml: jest.fn((xml: string) => ({ signedXml: `${xml}<ds:Signature/>` })) } as never,
      { validar: jest.fn(async () => ({ valido: true, errores: [], codigosDesconocidos: [], bloqueado: false, motivoBloqueo: null })) } as never,
      { persistFailure: jest.fn() } as never, { registrar } as never,
      { guardar: jest.fn(async () => 'hash') } as never, accounting as never,
    );
    await consumer.procesar({ invoice_id: 'inv-1' });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ motivoBloqueoAsiento: null, importes: expect.objectContaining({ gravado: 100, igv: 18, total: 108, descuentoNoAfecto: 10 }) }));
    expect(accounting.execute).not.toHaveBeenCalled();
  });

  it('el puente recibe la base e IGV netos del descuento global 02', async () => {
    const registrar = jest.fn<(factura: unknown) => Promise<unknown>>(async () => ({ movimientosRegistrados: 0, movimientosOmitidos: 0, asientoOmitido: false, asientoId: 'asiento-1', errores: [], completo: true }));
    const payload = { ...COMPROBANTE.payload_ubl, descuentoGlobal: { codigo: '02', monto: 10 }, lineasTributarias: [{ afectacion: '10', valorVenta: 100, igv: 18 }] };
    const fila = { ...COMPROBANTE, payload_ubl: payload, company_id: 'company-1', fecha_emision: new Date('2026-03-15T00:00:00.000Z'), items: [] };
    const findUnique = jest.fn<() => Promise<unknown>>().mockResolvedValueOnce(COMPROBANTE).mockResolvedValueOnce(fila);
    const consumer = new InvoiceJobConsumer(
      { registerInvoiceWorker: jest.fn() } as never,
      { processWithRetry: jest.fn<() => Promise<RetryInvoiceResult>>(async () => RESULTADO) } as never,
      { invoice: { findUnique, update: jest.fn() } } as never,
      { generateInvoiceXml: jest.fn(() => '<?xml version="1.0"?><Invoice/>') } as never,
      { validateInvoiceUbl21: jest.fn(() => ({ isValid: true, errors: [] })) } as never,
      { signXml: jest.fn((xml: string) => ({ signedXml: `${xml}<ds:Signature/>` })) } as never,
      { validar: jest.fn(async () => ({ valido: true, errores: [], codigosDesconocidos: [], bloqueado: false, motivoBloqueo: null })) } as never,
      { persistFailure: jest.fn() } as never, { registrar } as never,
      { guardar: jest.fn(async () => 'hash') } as never,
      { execute: jest.fn() } as never,
    );
    await consumer.procesar({ invoice_id: 'inv-1' });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ motivoBloqueoAsiento: null, importes: expect.objectContaining({ gravado: 90, igv: 16.2, total: 106.2 }) }));
  });

  it('calcula el hash SHA-256 del XML enviado', () => {
    const d = crearDobles();
    expect(d.consumidor.hashDelXml('abc')).toHaveLength(64);
  });
});

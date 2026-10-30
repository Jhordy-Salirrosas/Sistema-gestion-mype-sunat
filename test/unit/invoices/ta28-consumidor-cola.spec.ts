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
  processWithRetry: jest.Mock<() => Promise<RetryInvoiceResult>>;
  findUnique: jest.Mock<() => Promise<unknown>>;
  update: jest.Mock<() => Promise<unknown>>;
  signXml: jest.Mock<(xml: string) => { signedXml: string }>;
  generateInvoiceXml: jest.Mock<(payload: unknown) => string>;
  validate: jest.Mock<() => { isValid: boolean; errors: string[] }>;
}

function crearDobles(fila: unknown = COMPROBANTE): Dobles {
  const registerInvoiceWorker = jest.fn<
    (handler: (payload: { invoice_id: string }) => Promise<unknown>) => Promise<string>
  >(async () => 'worker-1');

  const processWithRetry = jest.fn<() => Promise<RetryInvoiceResult>>(
    async () => RESULTADO,
  );
  const findUnique = jest.fn<() => Promise<unknown>>(async () => fila);
  const update = jest.fn<() => Promise<unknown>>(async () => ({}));
  const signXml = jest.fn<(xml: string) => { signedXml: string }>((xml) => ({
    signedXml: `${xml}<ds:Signature/>`,
  }));
  const generateInvoiceXml = jest.fn<(payload: unknown) => string>(
    () => '<?xml version="1.0"?><Invoice/>',
  );
  const validate = jest.fn<() => { isValid: boolean; errors: string[] }>(() => ({
    isValid: true,
    errors: [],
  }));

  const consumidor = new InvoiceJobConsumer(
    { registerInvoiceWorker } as never,
    { processWithRetry } as never,
    { invoice: { findUnique, update } } as never,
    { generateInvoiceXml } as never,
    { validateInvoiceUbl21: validate } as never,
    { signXml } as never,
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

    expect(nombres).toEqual(['20601012341-01-F001-1.xml']);
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

  it('calcula el hash SHA-256 del XML enviado', () => {
    const d = crearDobles();
    expect(d.consumidor.hashDelXml('abc')).toHaveLength(64);
  });
});

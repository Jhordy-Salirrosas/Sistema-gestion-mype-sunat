import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { XsdValidatorService } from '../../../src/modules/invoices/xsdValidatorService';
import { SunatXslValidatorService } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';

const xml = new UblGeneratorService().generateInvoiceXml({
  rucEmisor: '20601012341', razonSocialEmisor: 'Empresa de prueba',
  tipoComprobante: '01', serie: 'F001', numero: 57,
  fechaEmision: '2026-10-20', tipoMoneda: 'PEN', tipoOperacion: '0101', formaPago: 'Contado',
  lineas: [{ id: 1, descripcion: 'Producto de prueba', unidad: 'NIU', cantidad: 1, valorUnitario: 1000, afectacion: '10', totalLinea: 1180, igvLinea: 180 }],
  cliente: { tipoDocumento: '6', numeroDocumento: '20100070970', razonSocial: 'Cliente de prueba' },
  montoGravado: 1000, montoIgv: 180, montoTotal: 1180,
}).replace('</Invoice>', '<ds:Signature/></Invoice>');

const inconcluso = {
  valido: false, errores: [], codigosDesconocidos: [], bloqueado: false,
  motivoBloqueo: 'Falta commons/error/validate_utils.xsl', validadoDeVerdad: false,
  causaNoConcluyente: 'DEPENDENCIA_VALIDATE_UTILS_AUSENTE',
};

function escenario(documento: string, resultadoXsl = inconcluso, xslReal?: SunatXslValidatorService) {
  const fila = { id: 'inv-1', ruc_emisor: '20601012341', tipo_comprobante: '01',
    serie: 'F001', correlativo: 57, estado: InvoiceStatus.EN_COLA,
    payload_ubl: {}, xml_storage_url: documento };
  const enviar = jest.fn(async () => null);
  const auditar = jest.fn(async (_args: unknown) => ({}));
  const validarXsl = jest.fn(async () => resultadoXsl);
  const validar = new XsdValidatorService();
  const comprobar = jest.spyOn(validar, 'validateInvoiceUbl21');
  const consumidor = new InvoiceJobConsumer(
    {} as never, { processWithRetry: enviar } as never,
    { invoice: { findUnique: jest.fn(async () => fila), update: jest.fn(async () => ({})) } } as never,
    {} as never, validar, { verifySignature: jest.fn(() => true) } as never, xslReal ?? ({ validar: validarXsl } as never),
    { persistFailure: auditar } as never, {} as never,
    { guardar: jest.fn(async () => 'hash-fixture') } as never,
    undefined, { resolve: jest.fn(async () => ({ environment: 'MOCK', endpoint: 'http://127.0.0.1/billService' })) } as never,
  );
  return { consumidor, enviar, auditar, comprobar };
}

describe('compuerta de despacho con XSL no concluyente', () => {
  beforeEach(() => { delete process.env.BYPASS_XSL_GATE_DEMO; });
  afterEach(() => { jest.restoreAllMocks(); });

  it('revalida el XML firmado guardado, persiste el aviso y llega al envío', async () => {
    const d = escenario(xml);
    await d.consumidor.procesar({ invoice_id: 'inv-1' });
    expect(d.comprobar).toHaveBeenCalledWith(xml);
    expect(d.enviar).toHaveBeenCalledTimes(1);
    expect(d.auditar).toHaveBeenCalledWith(expect.objectContaining({
      invoiceId: 'inv-1', estadoNuevo: InvoiceStatus.EN_COLA,
      mensajeError: expect.stringMatching(/XSL no concluyente.*validate_utils\.xsl/i),
    }));
  });

  it('bloquea el XML guardado que no cumple la estructura UBL', async () => {
    const d = escenario(xml.replace('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>', ''));
    await expect(d.consumidor.procesar({ invoice_id: 'inv-1' })).rejects.toThrow('M1_PREPARATION_PENDING');
    expect(d.enviar).not.toHaveBeenCalled();
    expect(d.comprobar).toHaveBeenCalled();
  });

  it('bloquea el XML guardado que incumple una regla interna', async () => {
    const d = escenario(xml.replace('20100070970', '20601012341'));
    await expect(d.consumidor.procesar({ invoice_id: 'inv-1' })).rejects.toThrow('M1_PREPARATION_PENDING');
    expect(d.enviar).not.toHaveBeenCalled();
    expect(d.comprobar).toHaveBeenCalled();
  });

  it('bloquea un rechazo real de la hoja XSL', async () => {
    const d = escenario(xml, { ...inconcluso, bloqueado: false, validadoDeVerdad: true,
      causaNoConcluyente: undefined as never,
      errores: [{ codigo: '2022', mensaje: 'Regla incumplida', regla: null }] as never });
    await d.consumidor.procesar({ invoice_id: 'inv-1' });
    expect(d.enviar).not.toHaveBeenCalled();
    expect(d.auditar).toHaveBeenCalledWith(expect.objectContaining({ estadoNuevo: InvoiceStatus.RECHAZADO }));
  });

  it('bloquea cualquier otro error del validador', async () => {
    const d = escenario(xml, { ...inconcluso, bloqueado: true, causaNoConcluyente: undefined as never,
      motivoBloqueo: 'Error inesperado del motor XSL' });
    await expect(d.consumidor.procesar({ invoice_id: 'inv-1' })).rejects.toThrow('Error inesperado');
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it('no deja pasar errores XSL aunque el resultado también traiga la marca de dependencia', async () => {
    const d = escenario(xml, { ...inconcluso, validadoDeVerdad: true,
      errores: [{ codigo: '2022', mensaje: 'Regla incumplida', regla: null }] as never });
    await d.consumidor.procesar({ invoice_id: 'inv-1' });
    expect(d.enviar).not.toHaveBeenCalled();
    expect(d.auditar).toHaveBeenCalledWith(expect.objectContaining({ estadoNuevo: InvoiceStatus.RECHAZADO }));
  });

  it('no despacha si no se puede persistir el aviso', async () => {
    const d = escenario(xml);
    d.auditar.mockImplementation(async () => { throw new Error('auditoría no disponible'); });
    await expect(d.consumidor.procesar({ invoice_id: 'inv-1' })).rejects.toThrow('auditoría no disponible');
    expect(d.auditar).toHaveBeenCalledTimes(2);
    expect(d.enviar).not.toHaveBeenCalled();
  });
});

describe('motor oficial SFS como única validación real', () => {
  afterEach(() => jest.restoreAllMocks());
  it('revalida en llamadas repetidas sin aprobar una firma vacía', async () => {
    const servicio = new SunatXslValidatorService();
    for (let i = 0; i < 2; i++) {
      const resultado = await servicio.validar(xml, '01');
      expect(resultado).toMatchObject({ valido: false, bloqueado: false, validadoDeVerdad: true });
      expect(resultado.errores).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'XSD' })]));
    }
  });
  it('el consumidor no despacha el XML que el SFS oficial rechaza', async () => {
    const d = escenario(xml, inconcluso, new SunatXslValidatorService());
    await d.consumidor.procesar({ invoice_id: 'inv-1' });
    expect(d.comprobar).not.toHaveBeenCalled();
    expect(d.enviar).not.toHaveBeenCalled();
    expect(d.auditar).toHaveBeenCalledWith(expect.objectContaining({ estadoNuevo: InvoiceStatus.RECHAZADO }));
  });
  it('un XML mal formado se rechaza con diagnóstico del SFS', async () => {
    const resultado = await new SunatXslValidatorService().validar(xml.replace('</Invoice>', '</Incorrecto>'), '01');
    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'XSD' })]));
    expect(resultado.causaNoConcluyente).toBeUndefined();
  });
});

/**
 * Pruebas UNITARIAS de SunatBillService para TT-05 (credenciales SOL).
 *
 * A diferencia de sunat-bill.integration.spec.ts, aqui NO hay red, NO hay Nest
 * ni Mock HTTP: el cliente SOAP y la persistencia son dobles de prueba, y se
 * inspecciona exactamente que recibe cada uno.
 *
 * Cubre:
 *  - el usuario SOL se arma como RUC + usuario secundario (sin duplicar el RUC);
 *  - sin variables SOL no se envian credenciales;
 *  - una credencial invalida (SOAP Fault 0102) se distingue del error de red.
 */
import { Logger } from '@nestjs/common';
import { InvoiceStatus } from '../../generated/prisma/enums';
import { CdrPersistenceService } from './cdr-persistence.service';
import { SunatSoapFaultError } from './soap/soap-envelope';
import { SunatSoapClient, SunatTransportError } from './soap/sunat-soap.client';
import { SunatBillService } from './sunat-bill.service';

const RUC = '20123456789';

const paramsBase = {
  invoiceId: 'factura-unitaria',
  rucEmisor: RUC,
  tipoComprobante: '01',
  serie: 'F001',
  correlativo: 1,
  zip: Buffer.from('zip-simulado'),
  estadoActual: InvoiceStatus.PROCESANDO,
};

describe('SunatBillService (unitaria) - credenciales SOL', () => {
  let sendBill: jest.Mock;
  let persistFailure: jest.Mock;
  let service: SunatBillService;

  const userPrevio = process.env.SUNAT_SOL_USER;
  const passPrevio = process.env.SUNAT_SOL_PASSWORD;

  beforeEach(() => {
    // Los avisos y errores del servicio no son parte de lo que se prueba aqui.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    delete process.env.SUNAT_SOL_USER;
    delete process.env.SUNAT_SOL_PASSWORD;

    // Sin applicationResponse el servicio termina por la ruta de fallo: basta
    // para inspeccionar con que credenciales se invoco al cliente SOAP.
    sendBill = jest
      .fn()
      .mockResolvedValue({ applicationResponse: null, tiempoRespuestaMs: 5 });
    persistFailure = jest.fn().mockResolvedValue({});

    service = new SunatBillService(
      {
        persist: jest.fn(),
        persistFailure,
      } as unknown as CdrPersistenceService,
      { sendBill } as unknown as SunatSoapClient,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (userPrevio === undefined) delete process.env.SUNAT_SOL_USER;
    else process.env.SUNAT_SOL_USER = userPrevio;
    if (passPrevio === undefined) delete process.env.SUNAT_SOL_PASSWORD;
    else process.env.SUNAT_SOL_PASSWORD = passPrevio;
  });

  it('arma el usuario SOL como RUC + usuario secundario', async () => {
    process.env.SUNAT_SOL_USER = 'MODDATOS';
    process.env.SUNAT_SOL_PASSWORD = 'clave-de-prueba';

    await service.sendAndProcess(paramsBase);

    expect(sendBill).toHaveBeenCalledTimes(1);
    expect(sendBill.mock.calls[0][0].credentials).toEqual({
      username: '20123456789MODDATOS',
      password: 'clave-de-prueba',
    });
  });

  it('no duplica el RUC si SUNAT_SOL_USER ya lo incluye', async () => {
    process.env.SUNAT_SOL_USER = '20123456789MODDATOS';
    process.env.SUNAT_SOL_PASSWORD = 'clave-de-prueba';

    await service.sendAndProcess(paramsBase);

    expect(sendBill.mock.calls[0][0].credentials.username).toBe(
      '20123456789MODDATOS',
    );
  });

  it('no envia credenciales si faltan las variables SOL', async () => {
    await service.sendAndProcess(paramsBase);

    expect(sendBill.mock.calls[0][0].credentials).toBeNull();
  });

  it('no envia credenciales si solo existe el usuario y falta la clave', async () => {
    process.env.SUNAT_SOL_USER = 'MODDATOS';

    await service.sendAndProcess(paramsBase);

    expect(sendBill.mock.calls[0][0].credentials).toBeNull();
  });

  it('una credencial invalida (SOAP Fault 0102) es error de autenticacion: no reintentable', async () => {
    process.env.SUNAT_SOL_USER = 'MODDATOS';
    process.env.SUNAT_SOL_PASSWORD = 'clave-incorrecta';
    sendBill.mockRejectedValue(
      new SunatSoapFaultError({
        faultCode: '0102',
        faultString: 'Usuario o contrasena incorrectos',
      }),
    );

    const resultado = await service.sendAndProcess(paramsBase);

    expect(resultado.responseCode).toBe('0102');
    expect(resultado.reintentable).toBe(false);
    expect(resultado.estado).not.toBe(InvoiceStatus.ENVIADO);
    expect(persistFailure).toHaveBeenCalledWith(
      expect.objectContaining({ codigoError: '0102' }),
    );
  });

  it('un error de red (timeout) es distinto: sin codigo SUNAT, reintentable y en ENVIADO', async () => {
    process.env.SUNAT_SOL_USER = 'MODDATOS';
    process.env.SUNAT_SOL_PASSWORD = 'clave-de-prueba';
    sendBill.mockRejectedValue(
      new SunatTransportError('Timeout tras 30000 ms'),
    );

    const resultado = await service.sendAndProcess(paramsBase);

    expect(resultado.responseCode).toBe('');
    expect(resultado.reintentable).toBe(true);
    expect(resultado.estado).toBe(InvoiceStatus.ENVIADO);
    expect(persistFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        codigoError: null,
        estadoNuevo: InvoiceStatus.ENVIADO,
      }),
    );
  });

  it('la clave SOL nunca aparece en el mensaje de error del resultado', async () => {
    process.env.SUNAT_SOL_USER = 'MODDATOS';
    process.env.SUNAT_SOL_PASSWORD = 'clave-secreta-123';
    sendBill.mockRejectedValue(
      new SunatSoapFaultError({
        faultCode: '0102',
        faultString: 'Usuario o contrasena incorrectos',
      }),
    );

    const resultado = await service.sendAndProcess(paramsBase);

    expect(String(resultado.error)).not.toContain('clave-secreta-123');
  });
});

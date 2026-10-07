/**
 * Prueba de INTEGRACION contra el Mock (criterio 6b de TA-03).
 *
 * A diferencia de cdr.parser.spec.ts (funcion pura, sin red), aqui se levanta
 * un servidor NestJS real con el Mock del billService y se ejercita el camino
 * completo del criterio 1:
 *
 *   SunatBillService -> SunatSoapClient -> POST SOAP real por HTTP ->
 *   Mock (sobre SOAP 1.1 + ZIP en Base64) -> decodificacion -> CDR -> estado
 *
 * Se verifica de paso lo que una prueba con fetch mockeado NO probaria: que el
 * sobre viaje bien formado y que el ZIP llegue integro en Base64.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import AdmZip from 'adm-zip';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { InvoiceStatus } from '../../generated/prisma/enums';
import { SunatBillMockController } from './mock/sunat-bill-mock.controller';
import { SunatBillService } from './sunat-bill.service';
import { SunatSoapFaultError } from './soap/soap-envelope';
import { SunatSoapClient, SunatTransportError } from './soap/sunat-soap.client';

jest.setTimeout(30_000);

/** ZIP ficticio: el Mock no lo abre, solo verifica que llegue como Base64. */
const ZIP_DE_PRUEBA = (() => {
  const zip = new AdmZip();
  zip.addFile(
    '20123456789-01-F001-1.xml',
    Buffer.from('<Invoice><ID>F001-00000001</ID></Invoice>', 'utf8'),
  );
  return zip.toBuffer();
})();

const paramsBase = {
  invoiceId: 'factura-de-prueba',
  rucEmisor: '20123456789',
  tipoComprobante: '01',
  serie: 'F001',
  correlativo: 1,
  zip: ZIP_DE_PRUEBA,
  estadoActual: InvoiceStatus.PROCESANDO,
};

describe('TA-03 - integracion contra el Mock del billService', () => {
  let app: INestApplication;
  let baseUrl: string;
  let service: SunatBillService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SunatBillMockController],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    await app.listen(0);

    const address = (app.getHttpServer() as Server).address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    service = new SunatBillService(
      new SunatSoapClient({
        endpoint: `${baseUrl}/api/v1/mocks/sunat/billService`,
      }),
    );
  });

  it('envia el sobre SOAP y procesa un CDR ACEPTADO de punta a punta', async () => {
    const resultado = await service.sendAndProcess(paramsBase);

    expect(resultado.responseCode).toBe('0');
    expect(resultado.estado).toBe(InvoiceStatus.ACEPTADO);
    expect(resultado.clasificacion.kind).toBe('ACEPTADO');
    expect(resultado.valido).toBe(true);
    expect(resultado.reintentable).toBe(false);

    // Criterio 3: se extraen ID, codigo de respuesta y descripcion.
    expect(resultado.cdr?.id).toBe('201656892705188');
    expect(resultado.cdr?.referenceId).toBe('F001-00000001');
    expect(resultado.cdr?.description).toContain('ha sido aceptada');

    // Criterio 6: tiempo de respuesta registrado.
    expect(resultado.tiempoRespuestaMs).toBeGreaterThanOrEqual(0);
    expect(resultado.error).toBeNull();
  });

  it('procesa un CDR RECHAZADO (2xxx) sin marcarlo como reintentable', async () => {
    const resultado = await service.sendAndProcess({
      ...paramsBase,
      serie: 'RECHAZADO',
    });

    expect(resultado.responseCode).toBe('2326');
    expect(resultado.estado).toBe(InvoiceStatus.RECHAZADO);
    expect(resultado.clasificacion.valido).toBe(false);
    // Reintentar no sirve: hay que emitir un comprobante nuevo.
    expect(resultado.reintentable).toBe(false);
    expect(resultado.cdr?.description).toBe(
      'El certificado usado se encuentra de baja',
    );
  });

  it('procesa un CDR ACEPTADO CON OBSERVACIONES (codigo 0 + Note)', async () => {
    const resultado = await service.sendAndProcess({
      ...paramsBase,
      serie: 'OBSERVACION',
    });

    expect(resultado.responseCode).toBe('0');
    expect(resultado.clasificacion.kind).toBe('ACEPTADO_CON_OBSERVACIONES');
    expect(resultado.estado).toBe(InvoiceStatus.ACEPTADO);
    expect(resultado.clasificacion.valido).toBe(true);
    expect(resultado.cdr?.observaciones[0].codigo).toBe('4031');
  });

  it('procesa una EXCEPCION 0100 como error recuperable', async () => {
    const resultado = await service.sendAndProcess({
      ...paramsBase,
      serie: 'EXCEPCION',
    });

    expect(resultado.responseCode).toBe('0100');
    expect(resultado.clasificacion.kind).toBe('EXCEPCION');
    expect(resultado.estado).toBe(InvoiceStatus.ERROR_RED);
    expect(resultado.reintentable).toBe(true);
  });

  it('maneja un SOAP Fault (HTTP 500) como error de NEGOCIO, no de red', async () => {
    const resultado = await service.sendAndProcess({
      ...paramsBase,
      serie: 'FAULT',
    });

    expect(resultado.error).toContain('SOAP Fault');
    expect(resultado.responseCode).toBe('0101');
    expect(resultado.clasificacion.kind).toBe('EXCEPCION');
    // 0101 = encabezado de seguridad incorrecto: determinista, no reintentar.
    expect(resultado.reintentable).toBe(false);
    expect(resultado.estado).toBe(InvoiceStatus.ERROR_RED);
  });

  it('el cliente propaga el SOAP Fault como excepcion tipada', async () => {
    const cliente = new SunatSoapClient({
      endpoint: `${baseUrl}/api/v1/mocks/sunat/billService`,
    });

    await expect(
      cliente.sendBill({
        fileName: '20123456789-01-FAULT-1.zip',
        zip: ZIP_DE_PRUEBA,
      }),
    ).rejects.toBeInstanceOf(SunatSoapFaultError);
  });

  it('el cliente reporta tiempo_respuesta_ms y el cuerpo crudo', async () => {
    const cliente = new SunatSoapClient({
      endpoint: `${baseUrl}/api/v1/mocks/sunat/billService`,
    });

    const resultado = await cliente.sendBill({
      fileName: '20123456789-01-F001-1.zip',
      zip: ZIP_DE_PRUEBA,
    });

    expect(resultado.tiempoRespuestaMs).toBeGreaterThanOrEqual(0);
    expect(resultado.httpStatus).toBe(200);
    expect(resultado.applicationResponse).toBeTruthy();
    // El cuerpo crudo se conserva para auditoria del CDR.
    expect(resultado.rawResponse).toContain('sendBillResponse');
  });

  it('maneja el timeout sin perder el job: deja el comprobante en ENVIADO', async () => {
    const servidorLento = createServer((req, _res) => {
      // Se consume el cuerpo pero NUNCA se responde: asi la peticion queda
      // colgada y el AbortSignal.timeout del cliente es el que corta.
      req.resume();
    });

    await new Promise<void>((resolve) => servidorLento.listen(0, resolve));
    const puertoLento = (servidorLento.address() as AddressInfo).port;

    const servicioLento = new SunatBillService(
      new SunatSoapClient({
        endpoint: `http://127.0.0.1:${puertoLento}/billService`,
        timeoutMs: 150,
      }),
    );

    const resultado = await servicioLento.sendAndProcess(paramsBase);

    expect(resultado.error).toContain('Timeout');
    // sendBill no es idempotente: ENVIADO (incierto), no ERROR_RED, para no
    // reenviar y duplicar el comprobante. Ver ADR-06.
    expect(resultado.estado).toBe(InvoiceStatus.ENVIADO);
    expect(resultado.reintentable).toBe(true);
    expect(resultado.cdr).toBeNull();

    await new Promise<void>((resolve) => servidorLento.close(() => resolve()));
  });

  it('trata un 503 sin SOAP Fault como error de transporte reintentable', async () => {
    const servidorCaido = createServer((_req, res) => {
      res.writeHead(503);
      res.end();
    });
    await new Promise<void>((resolve) => servidorCaido.listen(0, resolve));
    const puerto = (servidorCaido.address() as AddressInfo).port;

    const cliente = new SunatSoapClient({
      endpoint: `http://127.0.0.1:${puerto}/billService`,
      timeoutMs: 2_000,
    });

    await expect(
      cliente.sendBill({ fileName: 'x.zip', zip: ZIP_DE_PRUEBA }),
    ).rejects.toBeInstanceOf(SunatTransportError);

    await new Promise<void>((resolve) => servidorCaido.close(() => resolve()));
  });
});

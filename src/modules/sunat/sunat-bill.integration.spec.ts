/**
 * Prueba de INTEGRACION contra el Mock (criterio 6b de TA-03).
 *
 * A diferencia de cdr.parser.spec.ts (funcion pura, sin red), aqui se levanta
 * un servidor NestJS real con el Mock del billService y se ejercita el camino
 * completo:
 *
 *   SunatBillService -> SunatSoapClient -> POST SOAP real por HTTP ->
 *   Mock -> decodificacion -> clasificacion -> persistencia
 *
 * Se verifica de paso lo que una prueba con fetch mockeado NO probaria: que el
 * sobre viaje bien formado y que el ZIP llegue integro en Base64.
 */
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import AdmZip from 'adm-zip';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { InvoiceStatus } from '../../generated/prisma/enums';
import { CdrPersistenceService } from './cdr-persistence.service';
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

/**
 * Stub de persistencia: registra lo que se le pide escribir.
 * La escritura real a PostgreSQL se prueba en cdr-persistence.service.spec.ts.
 */
class PersistenceStub {
  public readonly persisted: Array<Record<string, unknown>> = [];
  public readonly failures: Array<Record<string, unknown>> = [];

  async persist(params: Record<string, unknown>) {
    this.persisted.push(params);
    return {
      invoice: { id: params.invoiceId, estado: null, updated_at: new Date() },
      history: { id: 'hist-1' },
    };
  }

  async persistFailure(params: Record<string, unknown>) {
    this.failures.push(params);
    return {
      invoice: { id: params.invoiceId, estado: null, updated_at: new Date() },
      history: { id: 'hist-2' },
    };
  }
}

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
  let persistence: PersistenceStub;
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
    persistence = new PersistenceStub();
    service = SunatBillService.create(
      persistence as unknown as CdrPersistenceService,
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

  it('TT-05: una credencial SOL invalida (0102) es error de autenticacion, no de red', async () => {
    const resultado = await service.sendAndProcess({
      ...paramsBase,
      serie: 'AUTH',
    });

    expect(resultado.error).toContain('SOAP Fault');
    expect(resultado.responseCode).toBe('0102');
    // 0102 = usuario o clave incorrectos: determinista, reintentar no sirve.
    expect(resultado.reintentable).toBe(false);
    // No es un fallo de transporte: nunca queda como ENVIADO (incierto).
    expect(resultado.estado).not.toBe(InvoiceStatus.ENVIADO);
    expect(resultado.estado).toBe(InvoiceStatus.ERROR_RED);

    // Queda auditado con su codigo, sin perder el comprobante.
    expect(persistence.failures).toHaveLength(1);
    expect(persistence.failures[0].codigoError).toBe('0102');
  });

  it('TT-05: avisa una sola vez, sin exponer valores, cuando faltan las credenciales SOL', async () => {
    const userPrevio = process.env.SUNAT_SOL_USER;
    const passPrevio = process.env.SUNAT_SOL_PASSWORD;
    delete process.env.SUNAT_SOL_USER;
    delete process.env.SUNAT_SOL_PASSWORD;
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    try {
      await service.sendAndProcess(paramsBase);
      await service.sendAndProcess(paramsBase);

      const avisos = warn.mock.calls
        .map(([mensaje]) => String(mensaje))
        .filter((mensaje) => mensaje.includes('Credenciales SOL incompletas'));

      // Dos envios, un solo aviso: no se llena el log en cada peticion.
      expect(avisos).toHaveLength(1);
      // Se nombran las variables faltantes, nunca sus valores.
      expect(avisos[0]).toContain('SUNAT_SOL_USER');
      expect(avisos[0]).toContain('SUNAT_SOL_PASSWORD');
    } finally {
      warn.mockRestore();
      if (userPrevio === undefined) delete process.env.SUNAT_SOL_USER;
      else process.env.SUNAT_SOL_USER = userPrevio;
      if (passPrevio === undefined) delete process.env.SUNAT_SOL_PASSWORD;
      else process.env.SUNAT_SOL_PASSWORD = passPrevio;
    }
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
    // Servidor que consume el cuerpo pero NUNCA responde: asi la peticion queda
    // colgada y el AbortSignal.timeout del cliente es el que corta.
    const servidorLento = createServer((req, _res) => {
      req.resume();
    });
    await new Promise<void>((resolve) => servidorLento.listen(0, resolve));
    const puertoLento = (servidorLento.address() as AddressInfo).port;

    const servicioLento = SunatBillService.create(
      persistence as unknown as CdrPersistenceService,
      new SunatSoapClient({
        endpoint: `http://127.0.0.1:${puertoLento}/billService`,
        timeoutMs: 150,
      }),
    );

    const resultado = await servicioLento.sendAndProcess(paramsBase);

    expect(resultado.error).toContain('Timeout');
    // sendBill no es idempotente: ENVIADO (incierto), no ERROR_RED. Ver ADR-06.
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

  it('persiste el CDR aceptado con su tiempo de respuesta (criterios 3 y 6)', async () => {
    await service.sendAndProcess(paramsBase);

    expect(persistence.persisted).toHaveLength(1);
    const guardado = persistence.persisted[0];

    expect(guardado.invoiceId).toBe('factura-de-prueba');
    expect((guardado.cdr as { responseCode: string }).responseCode).toBe('0');
    expect(guardado.tiempoRespuestaMs).toBeGreaterThanOrEqual(0);
    expect(guardado.estadoAnterior).toBe(InvoiceStatus.PROCESANDO);
    expect(guardado.intento).toBe(1);
  });

  it('persiste la observacion 4031 cuando el CDR viene observado', async () => {
    await service.sendAndProcess({ ...paramsBase, serie: 'OBSERVACION' });

    expect(persistence.persisted).toHaveLength(1);
    const guardado = persistence.persisted[0];
    const cdr = guardado.cdr as { observaciones: Array<{ codigo: string }> };
    const clasificacion = guardado.classification as { kind: string };

    expect(clasificacion.kind).toBe('ACEPTADO_CON_OBSERVACIONES');
    expect(cdr.observaciones[0].codigo).toBe('4031');
  });

  it('audita el SOAP Fault en el historial sin perder el job (criterio 5)', async () => {
    await service.sendAndProcess({ ...paramsBase, serie: 'FAULT' });

    expect(persistence.persisted).toHaveLength(0);
    expect(persistence.failures).toHaveLength(1);
    expect(persistence.failures[0].codigoError).toBe('0101');
    expect(String(persistence.failures[0].mensajeError)).toContain(
      'SOAP Fault',
    );
  });

  it('audita el timeout y deja el comprobante en ENVIADO (ADR-06)', async () => {
    const servidorMudo = createServer((req, _res) => {
      req.resume();
    });
    await new Promise<void>((resolve) => servidorMudo.listen(0, resolve));
    const puerto = (servidorMudo.address() as AddressInfo).port;

    const servicioLento = SunatBillService.create(
      persistence as unknown as CdrPersistenceService,
      new SunatSoapClient({
        endpoint: `http://127.0.0.1:${puerto}/billService`,
        timeoutMs: 150,
      }),
    );

    await servicioLento.sendAndProcess(paramsBase);

    expect(persistence.failures).toHaveLength(1);
    expect(persistence.failures[0].estadoNuevo).toBe(InvoiceStatus.ENVIADO);
    expect(String(persistence.failures[0].mensajeError)).toContain('Timeout');

    await new Promise<void>((resolve) => servidorMudo.close(() => resolve()));
  });
});

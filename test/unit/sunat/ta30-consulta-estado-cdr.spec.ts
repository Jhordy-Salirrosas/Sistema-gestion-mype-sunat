/**
 * TA-30 — Consulta de CDR y estado.
 *
 * La prueba que pide el backlog es exactamente la primera de este archivo:
 * un Mock que devuelve un CDR que el envío original NUNCA recibió, y el
 * sistema lo recupera en vez de reenviar.
 *
 * Se levanta un servidor HTTP real con el Mock del consultService: así se
 * prueba el sobre SOAP de verdad (que el XML viaje bien formado y que el ZIP
 * del CDR llegue íntegro en Base64), no solo la función que arma el XML.
 */
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import AdmZip from 'adm-zip';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { SunatStatusConsultaService } from '../../../src/modules/sunat/statusConsultaService';
import { SunatSoapClient } from '../../../src/modules/sunat/soap/sunat-soap.client';
import {
  buildGetStatusCdrEnvelope,
  GET_STATUS_CDR_SOAP_ACTION,
  parseGetStatusCdrResponse,
  SUNAT_CODE_NO_ENCONTRADO,
} from '../../../src/modules/sunat/soap/sunatStatusCdrOperation';
import { SunatConsultMockController } from '../../../src/modules/resilience/infrastructure/mock/sunatConsultMockController';

jest.setTimeout(20_000);

/** CDR de prueba: el comprobante F001-7 fue aceptado. */
function cdrAceptadoZip(): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse
  xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cac:DocumentResponse xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
    <cac:Response>
      <cbc:ReferenceID>F001-7</cbc:ReferenceID>
      <cbc:ResponseCode>0</cbc:ResponseCode>
      <cbc:Description>El comprobante ha sido aceptado</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;

  const zip = new AdmZip();
  zip.addFile('R-20601012341-01-F001-7.xml', Buffer.from(xml, 'utf8'));
  return zip.toBuffer().toString('base64');
}

/**
 * Servidor HTTP mínimo que emula el consultService.
 *
 * Se escribe a mano en vez de levantar Nest para que la prueba sea rápida y no
 * dependa de un módulo entero; lo que importa es el contrato HTTP/SOAP.
 */
class ConsultServiceFake {
  private server: Server | null = null;
  public baseUrl = '';
  public ultimoCuerpo = '';
  public ultimasCabeceras: Record<string, unknown> = {};
  public respuesta: (body: string) => { status: number; body: string } =
    () => ({ status: 200, body: sobreConCdr(cdrAceptadoZip()) });
  public demoraMs = 0;

  async start(): Promise<void> {
    this.server = createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        let datos = '';
        req.on('data', (chunk) => {
          datos += chunk;
        });
        req.on('end', async () => {
          this.ultimoCuerpo = datos;
          this.ultimasCabeceras = req.headers;
          if (this.demoraMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.demoraMs));
          }
          const { status, body } = this.respuesta(datos);
          res.writeHead(status, { 'Content-Type': 'text/xml' });
          res.end(body);
        });
      },
    );

    await new Promise<void>((resolve) => {
      this.server!.listen(0, '127.0.0.1', () => resolve());
    });

    const direccion = this.server.address() as AddressInfo;
    this.baseUrl = `http://127.0.0.1:${direccion.port}/billConsultService`;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = null;
  }
}

/** Sobre con el CDR en Base64. */
function sobreConCdr(base64: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ns0:getStatusCdrResponse xmlns:ns0="http://service.sunat.gob.pe">
      <ns0:statusCdrResult>${base64}</ns0:statusCdrResult>
    </ns0:getStatusCdrResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** Sobre sin CDR, con un código. */
function sobreConCodigo(codigo: string, mensaje: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ns0:getStatusCdrResponse xmlns:ns0="http://service.sunat.gob.pe">
      <ns0:statusCode>${codigo}</ns0:statusCode>
      <ns0:statusMessage>${mensaje}</ns0:statusMessage>
    </ns0:getStatusCdrResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

describe('TA-30 - sobre SOAP de getStatusCdr', () => {
  it('incluye tipo, serie y correlativo con el correlativo relleno a 8 dígitos', () => {
    const sobre = buildGetStatusCdrEnvelope({
      rucEmisor: '20601012341',
      tipoComprobante: '1',
      serie: 'f001',
      correlativo: 7,
    });

    expect(sobre).toContain('<ser:rucComprobante>20601012341</ser:rucComprobante>');
    expect(sobre).toContain('<ser:tipoComprobante>01</ser:tipoComprobante>');
    expect(sobre).toContain('<ser:serieComprobante>F001</ser:serieComprobante>');
    expect(sobre).toContain(
      '<ser:numeroComprobante>00000007</ser:numeroComprobante>',
    );
    expect(sobre).toContain('getStatusCdr');
  });

  it('no incluye WS-Security si no hay credenciales', () => {
    const sobre = buildGetStatusCdrEnvelope({
      rucEmisor: '20601012341',
      tipoComprobante: '01',
      serie: 'F001',
      correlativo: 1,
    });

    expect(sobre).not.toContain('UsernameToken');
  });

  it('incluye WS-Security cuando hay credenciales SOL', () => {
    const sobre = buildGetStatusCdrEnvelope({
      rucEmisor: '20601012341',
      tipoComprobante: '01',
      serie: 'F001',
      correlativo: 1,
      credentials: { username: '20601012341MODDATOS', password: 'x' },
    });

    expect(sobre).toContain('UsernameToken');
    expect(sobre).toContain('20601012341MODDATOS');
  });

  it('escapa caracteres especiales para no romper el XML', () => {
    const sobre = buildGetStatusCdrEnvelope({
      rucEmisor: '20&60',
      tipoComprobante: '01',
      serie: 'F<01',
      correlativo: 1,
    });

    expect(sobre).toContain('20&amp;60');
    expect(sobre).toContain('F&lt;01');
  });

  it('declara el SOAPAction de la operación', () => {
    expect(GET_STATUS_CDR_SOAP_ACTION).toBe('urn:getStatusCdr');
  });
});

describe('TA-30 - parseo de la respuesta', () => {
  it('extrae el CDR en Base64', () => {
    const parsed = parseGetStatusCdrResponse(sobreConCdr(cdrAceptadoZip()));
    expect(parsed.applicationResponse).toBe(cdrAceptadoZip());
  });

  it('extrae el código 0127 cuando SUNAT no tiene el comprobante', () => {
    const parsed = parseGetStatusCdrResponse(
      sobreConCodigo(SUNAT_CODE_NO_ENCONTRADO, 'No se encontro el comprobante'),
    );

    expect(parsed.responseCode).toBe('0127');
    expect(parsed.applicationResponse).toBeNull();
  });
});

describe('TA-30 - consulta contra el Mock (PRUEBA del backlog)', () => {
  const fake = new ConsultServiceFake();
  let servicio: SunatStatusConsultaService;
  let persistencia: {
    persist: jest.Mock;
    persistFailure: jest.Mock;
  };
  let prisma: {
    invoice: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const invoiceId = 'inv-timeout-1';

  const request = {
    invoiceId,
    rucEmisor: '20601012341',
    tipoComprobante: '01',
    serie: 'F001',
    correlativo: 7,
  };

  beforeAll(async () => {
    await fake.start();
  });

  afterAll(async () => {
    await fake.stop();
  });

  beforeEach(() => {
    persistencia = {
      persist: jest.fn().mockResolvedValue({}),
      persistFailure: jest.fn().mockResolvedValue({}),
    };
    prisma = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          estado: InvoiceStatus.ENVIADO,
          company_id: 'empresa-1',
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    servicio = new SunatStatusConsultaService(
      persistencia as never,
      prisma as never,
      new SunatSoapClient({ endpoint: fake.baseUrl, timeoutMs: 3000 }),
    );

    fake.respuesta = () => ({ status: 200, body: sobreConCdr(cdrAceptadoZip()) });
    fake.demoraMs = 0;
  });

  it('recupera el CDR que el envío original nunca recibió', async () => {
    const desenlace = await servicio.consultar(request);

    expect(desenlace.tipo).toBe('RECUPERADO');
    if (desenlace.tipo !== 'RECUPERADO') return;

    expect(desenlace.resultado.responseCode).toBe('0');
    expect(desenlace.resultado.estado).toBe(InvoiceStatus.ACEPTADO);
    expect(desenlace.resultado.cdr?.referenceId).toBe('F001-7');
  });

  it('persiste el CDR recuperado actualizando el estado', async () => {
    await servicio.consultar(request);

    expect(persistencia.persist).toHaveBeenCalledTimes(1);
    expect(persistencia.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId,
        estadoAnterior: InvoiceStatus.ENVIADO,
      }),
    );
  });

  it('audita el evento como recuperación (criterio 3)', async () => {
    await servicio.consultar(request);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'RECUPERACION_ESTADO_SUNAT',
          entity_id: invoiceId,
        }),
      }),
    );
  });

  it('envía el sobre con el SOAPAction correcto y el comprobante pedido', async () => {
    await servicio.consultar(request);

    expect(fake.ultimasCabeceras['soapaction']).toBe('"urn:getStatusCdr"');
    expect(fake.ultimoCuerpo).toContain('F001');
    expect(fake.ultimoCuerpo).toContain('00000007');
  });

  it('NO_ENCONTRADO cuando SUNAT responde 0127: reenviar es seguro', async () => {
    fake.respuesta = () => ({
      status: 200,
      body: sobreConCodigo(SUNAT_CODE_NO_ENCONTRADO, 'No existe'),
    });

    const desenlace = await servicio.consultar(request);

    expect(desenlace.tipo).toBe('NO_ENCONTRADO');
    // No se persiste nada: no hubo CDR que recuperar.
    expect(persistencia.persist).not.toHaveBeenCalled();
  });

  it('INCIERTO ante un timeout: NO se debe reenviar', async () => {
    fake.demoraMs = 500;
    servicio = new SunatStatusConsultaService(
      persistencia as never,
      prisma as never,
      new SunatSoapClient({ endpoint: fake.baseUrl, timeoutMs: 100 }),
    );

    const desenlace = await servicio.consultar(request);

    expect(desenlace.tipo).toBe('INCIERTO');
    expect(persistencia.persist).not.toHaveBeenCalled();
  });

  it('INCIERTO ante un 5xx sin CDR: tampoco se reenvía', async () => {
    fake.respuesta = () => ({
      status: 503,
      body: sobreConCodigo('0100', 'El sistema no puede responder'),
    });

    const desenlace = await servicio.consultar(request);

    expect(desenlace.tipo).toBe('INCIERTO');
  });

  it('recupera un comprobante que SUNAT rechazó después del timeout', async () => {
    fake.respuesta = () => ({
      status: 200,
      body: sobreConCdr(
        construirCdrRechazado(),
      ),
    });

    const desenlace = await servicio.consultar(request);

    expect(desenlace.tipo).toBe('RECUPERADO');
    if (desenlace.tipo !== 'RECUPERADO') return;
    expect(desenlace.resultado.estado).toBe(InvoiceStatus.RECHAZADO);
    expect(desenlace.resultado.reintentable).toBe(false);
  });
});

/** CDR de rechazo en Base64 (código 2326). */
function construirCdrRechazado(): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse
  xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>F001-7</cbc:ReferenceID>
      <cbc:ResponseCode>2326</cbc:ResponseCode>
      <cbc:Description>El certificado usado se encuentra de baja</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;

  const zip = new AdmZip();
  zip.addFile('R-20601012341-01-F001-7.xml', Buffer.from(xml, 'utf8'));
  return zip.toBuffer().toString('base64');
}

describe('TA-30 - Mock del consultService', () => {
  it('expone los modos que necesita la prueba de integración', () => {
    const controlador = new SunatConsultMockController();
    expect(typeof controlador.consultar).toBe('function');
  });
});

/**
 * Mock del consultService de SUNAT (TA-30).
 *
 * Va en un archivo propio y NO modifica `sunat-mock.service.ts` ni
 * `sunat-mock.controller.ts` (que son de HU-04/TA-12): así la rama de TA-30 se
 * puede integrar sin reescribir código ajeno.
 *
 * Qué emula: `getStatusCdr` por tipo + serie + correlativo. Se controla con
 * cabeceras para poder reproducir los tres desenlaces que interesa probar:
 *
 *   x-mock-consult: found      -> CDR con código 0 (comprobante aceptado)
 *   x-mock-consult: rejected   -> CDR con el código de x-mock-code
 *   x-mock-consult: notfound   -> código 0127 (SUNAT no lo tiene)
 *   x-mock-consult: timeout    -> no responde a tiempo
 *   x-mock-consult: error      -> HTTP 500 (consulta no concluyente)
 *
 * Por defecto responde `found`, que es lo que necesita el criterio de la
 * tarea: un CDR que el envío original nunca recibió.
 */
import {
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import AdmZip from 'adm-zip';

/** CDR con código 0127: SUNAT no conoce el comprobante. */
const CODIGO_NO_ENCONTRADO = '0127';

/** Modos de respuesta que entiende el Mock. */
export type ModoConsulta = 'found' | 'rejected' | 'notfound' | 'timeout' | 'error';

/** Extrae el contenido de una etiqueta del sobre (puede venir con prefijo). */
function extractTag(xml: string, tag: string): string {
  const patron = new RegExp(`<[\\w.-]*:?${tag}[^>]*>([\\s\\S]*?)</[\\w.-]*:?${tag}>`);
  const match = patron.exec(xml);
  return match ? match[1].trim() : '';
}

/**
 * Construye el XML del CDR de respuesta.
 *
 * `referenceId` es la clave: es lo que permite afirmar que SUNAT sí procesó
 * ESE comprobante y no otro.
 */
function construirCdr(params: {
  referenceId: string;
  responseCode: string;
  description: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse
  xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>${params.referenceId}</cbc:ID>
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>${params.referenceId}</cbc:ReferenceID>
      <cbc:ResponseCode>${params.responseCode}</cbc:ResponseCode>
      <cbc:Description>${params.description}</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;
}

/** Sobre SOAP con el CDR en Base64, como lo entrega SUNAT. */
function sobreConCdr(cdrXml: string, referenceId: string): string {
  const zip = new AdmZip();
  zip.addFile(`R-${referenceId}.xml`, Buffer.from(cdrXml, 'utf8'));
  const base64 = zip.toBuffer().toString('base64');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ns0:getStatusCdrResponse xmlns:ns0="http://service.sunat.gob.pe">
      <ns0:statusCdrResult>${base64}</ns0:statusCdrResult>
    </ns0:getStatusCdrResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Sobre con un código pero SIN CDR.
 *
 * Es el caso del 0127: SUNAT responde "no lo tengo". La ausencia de
 * `statusCdrResult` es justamente la señal de que no hay CDR que recuperar.
 */
function sobreSinCdr(codigo: string, descripcion: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ns0:getStatusCdrResponse xmlns:ns0="http://service.sunat.gob.pe">
      <ns0:statusCode>${codigo}</ns0:statusCode>
      <ns0:statusMessage>${descripcion}</ns0:statusMessage>
    </ns0:getStatusCdrResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

@Controller('mocks/sunat')
export class SunatConsultMockController {
  /**
   * Emula `getStatusCdr` del billConsultService.
   *
   * Responde 200 con un XML SOAP en el cuerpo, igual que el servicio real: los
   * errores de negocio viajan en el cuerpo, no en el status HTTP.
   */
  @Post('billConsultService')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml; charset=utf-8')
  async consultar(@Req() req: Request, @Res() res: Response): Promise<void> {
    const modo = String(req.headers['x-mock-consult'] ?? 'found') as ModoConsulta;
    const cuerpo = String(req.body ?? '');

    const serie = extractTag(cuerpo, 'serieComprobante');
    const numero = extractTag(cuerpo, 'numeroComprobante');
    const referenceId = `${serie}-${Number(numero) || 0}`;

    if (modo === 'timeout') {
      // Deja la petición colgada para que el cliente la corte por timeout.
      // El tiempo lo decide su AbortSignal: el Mock no lo conoce.
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      res.status(204).end();
      return;
    }

    if (modo === 'error') {
      res.status(503).type('text/xml').send(
        sobreSinCdr('0100', 'El sistema no puede responder su solicitud'),
      );
      return;
    }

    if (modo === 'notfound') {
      res
        .status(200)
        .type('text/xml')
        .send(
          sobreSinCdr(
            CODIGO_NO_ENCONTRADO,
            'No se encontro el comprobante solicitado',
          ),
        );
      return;
    }

    const responseCode = modo === 'rejected' ? this.codigoDeRechazo(req) : '0';
    const description =
      responseCode === '0'
        ? `El comprobante numero ${referenceId} ha sido aceptado`
        : `El comprobante numero ${referenceId} ha sido rechazado con codigo ${responseCode}`;

    res
      .status(200)
      .type('text/xml')
      .send(sobreConCdr(construirCdr({ referenceId, responseCode, description }), referenceId));
  }

  private codigoDeRechazo(req: Request): string {
    const codigo = String(req.headers['x-mock-code'] ?? '2326');
    return /^\d{4}$/.test(codigo) ? codigo : '2326';
  }
}

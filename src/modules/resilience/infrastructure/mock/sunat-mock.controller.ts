import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import getRawBody from 'raw-body';
import { SunatMockService } from './sunat-mock.service';

/** Extrae el contenido de un tag del sobre sin depender de un parser XML. */
function extractTag(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match ? match[1].trim() : '';
}

/** Sobre SOAP 1.1 con Fault, para los errores de formato de la peticion. */
function soapFault(code: string, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>${code}</faultcode>
      <faultstring>${message}</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;
}

@Controller('sunat-mock')
export class SunatMockController {
  constructor(private readonly sunatMockService: SunatMockService) {}

  /**
   * Emula el endpoint SOAP de SUNAT (billService).
   *
   * Los modos se pueden activar de dos formas, y ambas conviven:
   *
   *  A) Explicitamente, por header o query (TA-14):
   *     - x-mock-mode: REJECT + x-mock-code: 2324 -> CDR de rechazo (HTTP 200)
   *     - x-mock-mode: FAULT  + x-mock-code: ...  -> SOAP Fault (HTTP 500)
   *
   *  B) Por el RUC emisor del fileName (TA-12), sin cambiar la peticion:
   *     - 20111111112 -> HTTP 503
   *     - 20222222223 -> demora (timeout)
   *     - 20333333334 -> SOAP Fault
   *     - 20444444445 -> latencia configurable
   *
   * El cuerpo se lee crudo porque Nest ignora el Content-Type text/xml en su
   * parser por defecto: usar @Body() devolveria un objeto vacio y la activacion
   * por RUC no funcionaria nunca.
   */
  @Post('billService')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml;charset=UTF-8')
  async sendBill(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response,
    @Query('mode') queryMode?: string,
    @Query('code') queryCode?: string,
  ): Promise<void> {
    let envelope = '';

    if (typeof body === 'string') {
      envelope = body;
    } else if (req.readable) {
      // El stream aun no fue consumido: se lee crudo.
      try {
        envelope =
          (await getRawBody(req, { encoding: 'utf8', limit: '10mb' })) ?? '';
      } catch {
        envelope = '';
      }
    }

    res.type('text/xml');

    const fileName = extractTag(envelope, 'fileName');
    const contentFile = extractTag(envelope, 'contentFile');

    // Modos explicitos por header o query (TA-14). Actuan antes de la
    // validacion del contrato porque no dependen del cuerpo SOAP.
    const explicitMode = (
      (req.headers['x-mock-mode'] as string) ||
      queryMode ||
      ''
    ).toUpperCase();
    const explicitCode =
      (req.headers['x-mock-code'] as string) || queryCode || '';

    if (explicitMode === 'FAULT' || explicitMode === 'SOAP_FAULT') {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      res.send(
        this.sunatMockService.generateSoapFaultResponse(
          explicitCode || 'S:Client.0100',
          'El comprobante no cumple con la estructura XML SOAP requerida',
        ),
      );
      return;
    }

    if (explicitMode === 'REJECT' || explicitMode === 'RECHAZO') {
      const rejectCode = explicitCode || '2324';
      res.status(HttpStatus.OK);
      res.send(
        this.sunatMockService.generateSendBillResponse({
          responseCode: rejectCode,
          description: `El comprobante numero F001-1 ha sido rechazado con codigo ${rejectCode}`,
        }),
      );
      return;
    }

    // El contrato exige fileName y contentFile (ZIP en Base64).
    if (!fileName) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      res.send(soapFault('0151', 'El nombre del archivo ZIP es incorrecto'));
      return;
    }

    if (!contentFile) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      res.send(soapFault('0159', 'El nombre del archivo XML es incorrecto'));
      return;
    }

    // El servicio decide segun el RUC del fileName: inyecta el fallo
    // correspondiente o devuelve el CDR aceptado.
    const response = await this.sunatMockService.resolveResponse(fileName);

    res.status(response.status);
    res.send(response.body);
  }
}

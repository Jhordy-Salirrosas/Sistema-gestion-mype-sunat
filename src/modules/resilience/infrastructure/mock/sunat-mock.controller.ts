import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
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
   * El RUC emisor viaja dentro del nombre del archivo ZIP del request, y es lo
   * que determina si se inyecta un fallo:
   *  - 20111111112 -> HTTP 503
   *  - 20222222223 -> demora (timeout)
   *  - 20333333334 -> SOAP Fault
   *  - 20444444445 -> latencia configurable
   *  - cualquier otro -> CDR aceptado, como antes
   *
   * El cuerpo se lee crudo porque Nest ignora el Content-Type text/xml en su
   * parser por defecto: usar @Body() devolveria un objeto vacio y ningun modo
   * se activaria nunca.
   */
  @Post('billService')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml;charset=UTF-8')
  async sendBill(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response,
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

    const fileName = extractTag(envelope, 'fileName');
    const contentFile = extractTag(envelope, 'contentFile');

    res.type('text/xml');

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

    // El servicio decide la respuesta segun el RUC del fileName: inyecta el
    // fallo correspondiente o devuelve el CDR aceptado.
    const response = await this.sunatMockService.resolveResponse(fileName);

    res.status(response.status);
    res.send(response.body);
  }
}

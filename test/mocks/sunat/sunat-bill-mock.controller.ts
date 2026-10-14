/**
 * Mock del billService de SUNAT para pruebas.
 *
 * Emula el contrato verificado en el WSDL oficial:
 *  - POST /api/v1/mocks/sunat/billService
 *  - Envoltura SOAP 1.1, operacion sendBill (namespace
 *    http://service.sunat.gob.pe)
 *  - Respuesta: sendBillResponse > applicationResponse (ZIP en Base64)
 */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import getRawBody from 'raw-body';
import {
  CdrMockScenario,
  MOCK_CDR_BY_SCENARIO,
  MOCK_SCENARIO_KEYWORDS,
} from './cdr-mock.fixtures';

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

/** Elige el escenario segun el nombre del archivo recibido. */
export function resolveScenario(fileName: string): CdrMockScenario {
  const upper = (fileName ?? '').toUpperCase();
  const found = MOCK_SCENARIO_KEYWORDS.find((item) =>
    upper.includes(item.keyword),
  );
  return found ? found.scenario : 'ACEPTADO';
}

/** Extrae el contenido de un tag del sobre sin depender de un parser XML. */
function extractTag(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match ? match[1].trim() : '';
}

@Controller('api/v1/mocks/sunat')
export class SunatBillMockController {
  @Post('billService')
  @HttpCode(HttpStatus.OK)
  async billService(
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

    // Casos de prueba explícitos de SOAP Fault.
    const upperFileName = fileName.toUpperCase();

    // Credenciales SOL inválidas.
    if (upperFileName.includes('AUTH')) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      res.send(soapFault('0102', 'El usuario o la clave SOL son incorrectos'));
      return;
    }

    // Encabezado WS-Security incorrecto.
    if (upperFileName.includes('FAULT')) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      res.send(soapFault('0101', 'El encabezado de seguridad es incorrecto'));
      return;
    }

    const scenario = resolveScenario(fileName);
    const applicationResponse = MOCK_CDR_BY_SCENARIO[scenario];

    res.status(HttpStatus.OK);
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe">
  <soapenv:Body>
    <ser:sendBillResponse>
      <applicationResponse>${applicationResponse}</applicationResponse>
    </ser:sendBillResponse>
  </soapenv:Body>
</soapenv:Envelope>`);
  }
}

/**
 * Mock del billService de SUNAT.
 *
 * Emula el contrato verificado en el WSDL oficial:
 *  - POST /api/v1/mocks/sunat/billService
 *  - Envoltura SOAP 1.1, operacion sendBill (namespace
 *    http://service.sunat.gob.pe)
 *  - Respuesta: sendBillResponse > applicationResponse (ZIP en Base64)
 *
 * El caso de respuesta se elige por palabra clave en el fileName, igual que el
 * enrutamiento por RUC del inyector de fallos (TA-10): asi no hay que tocar
 * codigo entre pruebas.
 *
 * LECTURA DEL CUERPO: el cliente envia Content-Type text/xml, que el parser
 * JSON de Nest ignora, asi que @Body() llega vacio. Por eso se lee el stream
 * crudo con raw-body, verificando que sea legible antes de intentarlo.
 *
 * NOTA: este Mock es el minimo que TA-03 necesita para su prueba de integracion
 * autocontenida. El Mock definitivo, con los 4 tipos de comprobante, es TA-06.
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

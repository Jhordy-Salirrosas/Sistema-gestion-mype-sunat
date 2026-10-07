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
 * NOTA: este Mock es el minimo que TA-03 necesita para su prueba de integracion
 * autocontenida. El Mock definitivo, con los 4 tipos de comprobante, es TA-06.
 */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
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
  billService(@Body() body: unknown, @Res() res: Response): void {
    const envelope = typeof body === 'string' ? body : '';
    const fileName = extractTag(envelope, 'fileName');
    const contentFile = extractTag(envelope, 'contentFile');

    res.type('text/xml');

    // El contrato exige contentFile (ZIP en Base64) y fileName.
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
    // Caso de prueba explicito de SOAP Fault.
    if (fileName.toUpperCase().includes('FAULT')) {
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

/**
 * Mock del billConsultService (TA-30).
 *
 * El mock se controla con cabeceras para reproducir los tres desenlaces que
 * interesan: comprobante encontrado, rechazado y no encontrado. Se prueba
 * directamente sobre el controlador para no levantar un servidor HTTP.
 */
import AdmZip from 'adm-zip';
import type { Request, Response } from 'express';
import { SunatConsultMockController } from '../../../src/modules/resilience/infrastructure/mock/sunatConsultMockController';

const CUERPO = `<soapenv:Body>
  <serieComprobante>F001</serieComprobante>
  <numeroComprobante>7</numeroComprobante>
</soapenv:Body>`;

function crearRespuesta() {
  const res = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response & typeof res;
}

/** Extrae el CDR que viaja comprimido en Base64 dentro del sobre SOAP. */
function cdrDelSobre(sobre: string): string {
  const base64 = /<ns0:statusCdrResult>([^<]+)<\/ns0:statusCdrResult>/.exec(sobre)?.[1];
  if (!base64) throw new Error('El sobre no trae statusCdrResult');
  const zip = new AdmZip(Buffer.from(base64, 'base64'));
  return zip.readAsText(zip.getEntries()[0]);
}

function crearPeticion(headers: Record<string, string> = {}) {
  return { headers, body: CUERPO } as unknown as Request;
}

describe('SunatConsultMockController', () => {
  const controlador = new SunatConsultMockController();

  it('devuelve un CDR aceptado por defecto, con la referencia consultada', async () => {
    const res = crearRespuesta();

    await controlador.consultar(crearPeticion(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const cdr = cdrDelSobre(res.send.mock.calls[0][0] as string);
    expect(cdr).toContain('<cbc:ReferenceID>F001-7</cbc:ReferenceID>');
    expect(cdr).toContain('<cbc:ResponseCode>0</cbc:ResponseCode>');
  });

  it('responde rechazo con el código indicado en x-mock-code', async () => {
    const res = crearRespuesta();

    await controlador.consultar(
      crearPeticion({ 'x-mock-consult': 'rejected', 'x-mock-code': '1033' }),
      res,
    );

    const cdr = cdrDelSobre(res.send.mock.calls[0][0] as string);
    expect(cdr).toContain('<cbc:ResponseCode>1033</cbc:ResponseCode>');
  });

  it('usa el código 2326 si x-mock-code no tiene cuatro dígitos', async () => {
    const res = crearRespuesta();

    await controlador.consultar(
      crearPeticion({ 'x-mock-consult': 'rejected', 'x-mock-code': 'abc' }),
      res,
    );

    const cdr = cdrDelSobre(res.send.mock.calls[0][0] as string);
    expect(cdr).toContain('<cbc:ResponseCode>2326</cbc:ResponseCode>');
  });

  it('responde 0127 cuando SUNAT no conoce el comprobante', async () => {
    const res = crearRespuesta();

    await controlador.consultar(
      crearPeticion({ 'x-mock-consult': 'notfound' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const xml = res.send.mock.calls[0][0] as string;
    expect(xml).toContain('<ns0:statusCode>0127</ns0:statusCode>');
  });

  it('responde 503 cuando la consulta no es concluyente', async () => {
    const res = crearRespuesta();

    await controlador.consultar(crearPeticion({ 'x-mock-consult': 'error' }), res);

    expect(res.status).toHaveBeenCalledWith(503);
    const xml = res.send.mock.calls[0][0] as string;
    expect(xml).toContain('<ns0:statusCode>0100</ns0:statusCode>');
  });
});

/**
 * TA-28 - Operacion getStatusCdr (billConsultService).
 *
 * Se usa cuando el envio quedo en estado INCIERTO: el sobre salio pero la
 * respuesta se perdio. Antes de reenviar hay que preguntar si SUNAT ya proceso
 * el comprobante, porque un segundo sendBill del mismo numero vuelve con 1032
 * (duplicidad) y el comprobante queda marcado como rechazado.
 *
 * El caso critico es el 0127: SUNAT no lo tiene y reenviar es seguro.
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildGetStatusCdrEnvelope,
  GET_STATUS_CDR_SOAP_ACTION,
  parseGetStatusCdrResponse,
  SUNAT_CODE_NO_ENCONTRADO,
} from '../../../src/modules/sunat/soap/sunatStatusCdr.operation';

const CREDENCIALES = { username: '20601012341MODDATOS', password: 'clave' };

const PARAMS = {
  rucComprobante: '20601012341',
  tipoComprobante: '01',
  serieComprobante: 'F001',
  numeroComprobante: 42,
  credentials: CREDENCIALES,
};

/** Sobre de respuesta del billConsultService con statusCdr. */
function sobre(statusCode: string, content = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
  <soap-env:Body>
    <ns2:getStatusCdrResponse xmlns:ns2="http://service.sunat.gob.pe">
      <statusCdr>
        <statusCode>${statusCode}</statusCode>
        <statusMessage>Observado por SUNAT</statusMessage>
        <content>${content}</content>
      </statusCdr>
    </ns2:getStatusCdrResponse>
  </soap-env:Body>
</soap-env:Envelope>`;
}

describe('TA-28 getStatusCdr', () => {
  it('usa la SOAPAction oficial de la operacion', () => {
    expect(GET_STATUS_CDR_SOAP_ACTION).toBe('urn:getStatusCdr');
  });

  describe('sobre de peticion', () => {
    it('incluye los cuatro campos obligatorios del WSDL', () => {
      const sobre = buildGetStatusCdrEnvelope(PARAMS);

      expect(sobre).toContain('<rucComprobante>20601012341</rucComprobante>');
      expect(sobre).toContain('<tipoComprobante>01</tipoComprobante>');
      expect(sobre).toContain('<serieComprobante>F001</serieComprobante>');
      expect(sobre).toContain('<numeroComprobante>42</numeroComprobante>');
    });

    it('normaliza tipo a dos caracteres y serie a mayusculas', () => {
      const sobre = buildGetStatusCdrEnvelope({
        ...PARAMS,
        tipoComprobante: '3',
        serieComprobante: ' b001 ',
      });

      expect(sobre).toContain('<tipoComprobante>03</tipoComprobante>');
      expect(sobre).toContain('<serieComprobante>B001</serieComprobante>');
    });

    it('arma la cabecera WS-Security cuando hay credenciales SOL', () => {
      const sobre = buildGetStatusCdrEnvelope(PARAMS);

      expect(sobre).toContain('wsse:Security');
      expect(sobre).toContain(
        '<wsse:Username>20601012341MODDATOS</wsse:Username>',
      );
    });

    it('omite la cabecera WS-Security sin credenciales', () => {
      const sobre = buildGetStatusCdrEnvelope({
        ...PARAMS,
        credentials: null,
      });

      expect(sobre).not.toContain('wsse:Security');
      expect(sobre).toContain('<soapenv:Header/>');
    });

    it('escapa la contraseña para no romper el XML', () => {
      const sobre = buildGetStatusCdrEnvelope({
        ...PARAMS,
        credentials: { username: 'x', password: 'a<b&c' },
      });

      expect(sobre).toContain('a&lt;b&amp;c');
    });

    it('declara los namespaces de SOAP y de SUNAT', () => {
      const sobre = buildGetStatusCdrEnvelope(PARAMS);

      expect(sobre).toContain('soapenv:Envelope');
      expect(sobre).toContain('service.sunat.gob.pe');
      expect(sobre).toContain(':getStatusCdr>');
    });
  });

  describe('respuesta', () => {
    it('extrae codigo, mensaje y el CDR en Base64', () => {
      const parsed = parseGetStatusCdrResponse(sobre('0000', 'UEsDBAoAAAAA'));

      expect(parsed.statusCode).toBe('0000');
      expect(parsed.statusMessage).toBe('Observado por SUNAT');
      expect(parsed.applicationResponse).toBe('UEsDBAoAAAAA');
      expect(parsed.faultCode).toBeNull();
    });

    it('devuelve el codigo 0127 cuando SUNAT no tiene el comprobante', () => {
      const parsed = parseGetStatusCdrResponse(sobre(SUNAT_CODE_NO_ENCONTRADO));

      expect(parsed.statusCode).toBe('0127');
      expect(parsed.applicationResponse).toBeNull();
    });

    it('conserva el codigo como string: 0100 no es 100', () => {
      const parsed = parseGetStatusCdrResponse(sobre('0100'));
      expect(parsed.statusCode).toBe('0100');
    });

    it('extrae el Fault cuando SUNAT responde con error de negocio', () => {
      const xml = `<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
        <soap-env:Body>
          <soap-env:Fault>
            <faultcode>soap-env:Client</faultcode>
            <faultstring>Credenciales invalidas</faultstring>
          </soap-env:Fault>
        </soap-env:Body>
      </soap-env:Envelope>`;

      const parsed = parseGetStatusCdrResponse(xml);

      expect(parsed.faultCode).toBe('soap-env:Client');
      expect(parsed.faultString).toBe('Credenciales invalidas');
      expect(parsed.statusCode).toBeNull();
    });

    it('no rompe con un XML malformado', () => {
      const parsed = parseGetStatusCdrResponse('<no-es-xml');

      expect(parsed.statusCode).toBeNull();
      expect(parsed.applicationResponse).toBeNull();
    });

    it('devuelve todo nulo si el sobre no trae Body', () => {
      const parsed = parseGetStatusCdrResponse('<a><b>1</b></a>');

      expect(parsed.statusCode).toBeNull();
      expect(parsed.faultCode).toBeNull();
    });
  });
});

/**
 * TA-28 - Operacion getStatusCdr del billConsultService.
 *
 * Cubre lo que exige el criterio 6c de la HU: ante un timeout no se reenvia el
 * comprobante, se consulta el estado. Aqui se prueba la capa de protocolo:
 * el sobre armado, el parseo de statusCdr y la distincion entre "existe",
 * "no existe (0127)" y "Fault".
 */
import {
  buildGetStatusCdrEnvelope,
  parseGetStatusCdrResponse,
  SUNAT_CODE_NO_ENCONTRADO,
} from '../../../src/modules/sunat/soap/sunatStatusCdr.operation';

const PARAMS = {
  rucComprobante: '20601012341',
  tipoComprobante: '01',
  serieComprobante: 'F001',
  numeroComprobante: 7,
};

function sobreConStatusCdr(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ser:getStatusCdrResponse xmlns:ser="http://service.sunat.gob.pe">
      ${inner}
    </ser:getStatusCdrResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

describe('TA-28 getStatusCdr - construccion del sobre', () => {
  it('arma la operacion con los cuatro campos obligatorios', () => {
    const sobre = buildGetStatusCdrEnvelope(PARAMS);

    expect(sobre).toContain('<ser:getStatusCdr>');
    expect(sobre).toContain('<rucComprobante>20601012341</rucComprobante>');
    expect(sobre).toContain('<tipoComprobante>01</tipoComprobante>');
    expect(sobre).toContain('<serieComprobante>F001</serieComprobante>');
    expect(sobre).toContain('<numeroComprobante>7</numeroComprobante>');
  });

  it('usa el namespace del Body service.sunat.gob.pe, no el del WSDL', () => {
    const sobre = buildGetStatusCdrEnvelope(PARAMS);

    expect(sobre).toContain('xmlns:ser="http://service.sunat.gob.pe"');
  });

  it('normaliza el tipo a dos digitos y la serie a mayusculas', () => {
    const sobre = buildGetStatusCdrEnvelope({
      ...PARAMS,
      tipoComprobante: '1',
      serieComprobante: 'f001',
    });

    expect(sobre).toContain('<tipoComprobante>01</tipoComprobante>');
    expect(sobre).toContain('<serieComprobante>F001</serieComprobante>');
  });

  it('omite el Header WS-Security cuando no hay credenciales (Mock)', () => {
    const sobre = buildGetStatusCdrEnvelope({ ...PARAMS, credentials: null });

    expect(sobre).toContain('<soapenv:Header/>');
    expect(sobre).not.toContain('wsse:Security');
  });

  it('incluye UsernameToken cuando se pasan credenciales SOL', () => {
    const sobre = buildGetStatusCdrEnvelope({
      ...PARAMS,
      credentials: { username: '20601012341MODDATOS', password: 'clave' },
    });

    expect(sobre).toContain('<wsse:Username>20601012341MODDATOS</wsse:Username>');
    expect(sobre).toContain('>clave</wsse:Password>');
  });

  it('escapa el RUC para no romper el XML', () => {
    const sobre = buildGetStatusCdrEnvelope({
      ...PARAMS,
      rucComprobante: '2060&1<2',
    });

    expect(sobre).toContain('2060&amp;1&lt;2');
  });
});

describe('TA-28 getStatusCdr - parseo de la respuesta', () => {
  it('extrae statusCode, mensaje y CDR en Base64', () => {
    const xml = sobreConStatusCdr(`
      <statusCdr>
        <statusCode>0000</statusCode>
        <statusMessage>El comprobante fue aceptado</statusMessage>
        <content>UEsDBAoAAAA=</content>
      </statusCdr>`);

    const r = parseGetStatusCdrResponse(xml);

    expect(r.statusCode).toBe('0000');
    expect(r.statusMessage).toBe('El comprobante fue aceptado');
    expect(r.applicationResponse).toBe('UEsDBAoAAAA=');
    expect(r.faultCode).toBeNull();
  });

  it('detecta el 0127 como comprobante no encontrado', () => {
    const xml = sobreConStatusCdr(`
      <statusCdr>
        <statusCode>0127</statusCode>
        <statusMessage>No existe informacion del comprobante</statusMessage>
      </statusCdr>`);

    const r = parseGetStatusCdrResponse(xml);

    expect(r.statusCode).toBe(SUNAT_CODE_NO_ENCONTRADO);
    expect(r.applicationResponse).toBeNull();
  });

  it('trata content vacio como ausencia de CDR, no como string vacio', () => {
    const xml = sobreConStatusCdr(`
      <statusCdr>
        <statusCode>0000</statusCode>
        <content>   </content>
      </statusCdr>`);

    expect(parseGetStatusCdrResponse(xml).applicationResponse).toBeNull();
  });

  it('extrae un SOAP Fault en lugar de lanzarlo', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>soap-env:Server</faultcode>
      <faultstring>0102 Usuario o contrasena incorrectos</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;

    const r = parseGetStatusCdrResponse(xml);

    expect(r.faultString).toContain('0102');
    expect(r.statusCode).toBeNull();
  });

  it('no rompe con un cuerpo que no es XML', () => {
    const r = parseGetStatusCdrResponse('<html>502 Bad Gateway');

    expect(r.statusCode).toBeNull();
    expect(r.applicationResponse).toBeNull();
  });
});

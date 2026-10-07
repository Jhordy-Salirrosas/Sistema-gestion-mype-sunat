/**
 * Pruebas del contrato SOAP: construccion del sobre y lectura de la respuesta.
 *
 * Son pruebas unitarias puras: NO hay red, NO hay Nest y NO se llama a SUNAT.
 */
import {
  buildSendBillEnvelope,
  extractSunatCode,
  parseSendBillResponse,
  SunatSoapFaultError,
} from './soap-envelope';
import {
  buildZipFileName,
  WSSE_NAMESPACE,
  WSSE_PASSWORD_TYPE,
} from './soap.constants';

const ZIP_MINIMO = Buffer.from('PK-contenido-simulado').toString('base64');

describe('buildSendBillEnvelope', () => {
  it('usa el namespace del Body correcto y la operacion sendBill', () => {
    const envelope = buildSendBillEnvelope({
      fileName: '20123456789-01-F001-1.zip',
      contentFileBase64: ZIP_MINIMO,
    });

    expect(envelope).toContain('xmlns:ser="http://service.sunat.gob.pe"');
    expect(envelope).toContain(
      'xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"',
    );
    expect(envelope).toContain('<ser:sendBill>');
    expect(envelope).toContain('</ser:sendBill>');
    expect(envelope).not.toContain('comppago');
  });

  it('respeta el orden fileName, contentFile del XSD', () => {
    const envelope = buildSendBillEnvelope({
      fileName: '20123456789-01-F001-1.zip',
      contentFileBase64: ZIP_MINIMO,
    });

    expect(envelope.indexOf('<fileName>')).toBeLessThan(
      envelope.indexOf('<contentFile>'),
    );
  });

  it('va sin WS-Security cuando no hay credenciales', () => {
    const envelope = buildSendBillEnvelope({
      fileName: '20123456789-01-F001-1.zip',
      contentFileBase64: ZIP_MINIMO,
      credentials: null,
    });

    expect(envelope).toContain('<soapenv:Header/>');
    expect(envelope).not.toContain('UsernameToken');
  });

  it('incluye UsernameToken con PasswordText cuando hay credenciales', () => {
    const envelope = buildSendBillEnvelope({
      fileName: '20123456789-01-F001-1.zip',
      contentFileBase64: ZIP_MINIMO,
      credentials: { username: '20123456789MODDATOS', password: 'clave-sol' },
    });

    expect(envelope).toContain('wsse:Security');
    expect(envelope).toContain(WSSE_NAMESPACE);
    expect(envelope).toContain(
      '<wsse:Username>20123456789MODDATOS</wsse:Username>',
    );
    expect(envelope).toContain(`Type="${WSSE_PASSWORD_TYPE}"`);
    expect(envelope).toContain('<wsse:Password');
  });

  it('escapa caracteres peligrosos en el nombre del archivo', () => {
    const envelope = buildSendBillEnvelope({
      fileName: 'a&b<c>.zip',
      contentFileBase64: ZIP_MINIMO,
    });

    expect(envelope).toContain('<fileName>a&amp;b&lt;c&gt;.zip</fileName>');
  });
});

describe('parseSendBillResponse', () => {
  it('extrae applicationResponse del sobre de respuesta', () => {
    const respuesta = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ns2:sendBillResponse xmlns:ns2="http://service.sunat.gob.pe">
      <applicationResponse>UEsDBBQAAAA=</applicationResponse>
    </ns2:sendBillResponse>
  </soapenv:Body>
</soapenv:Envelope>`;

    const parsed = parseSendBillResponse(respuesta);

    expect(parsed.fault).toBeNull();
    expect(parsed.applicationResponse).toBe('UEsDBBQAAAA=');
  });

  it('detecta un SOAP Fault y extrae el codigo de negocio', () => {
    const fault = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>0101</faultcode>
      <faultstring>El encabezado de seguridad es incorrecto</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;

    const parsed = parseSendBillResponse(fault);

    expect(parsed.applicationResponse).toBeNull();
    expect(parsed.fault).toBeInstanceOf(SunatSoapFaultError);
    expect(parsed.fault?.sunatCode).toBe('0101');
    expect(parsed.fault?.faultString).toBe(
      'El encabezado de seguridad es incorrecto',
    );
  });

  it('extrae el codigo aunque venga embebido en el faultstring', () => {
    const fault = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultstring>0156 El archivo ZIP esta vacio</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;

    expect(parseSendBillResponse(fault).fault?.sunatCode).toBe('0156');
  });

  it('devuelve applicationResponse nulo si viene vacio', () => {
    const respuesta = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ser:sendBillResponse xmlns:ser="http://service.sunat.gob.pe">
      <applicationResponse></applicationResponse>
    </ser:sendBillResponse>
  </soapenv:Body>
</soapenv:Envelope>`;

    expect(parseSendBillResponse(respuesta).applicationResponse).toBeNull();
  });

  it('no explota con un cuerpo que no es XML', () => {
    const parsed = parseSendBillResponse(
      '<html><body>502 Bad Gateway</body></html>',
    );

    expect(parsed.applicationResponse).toBeNull();
    expect(parsed.fault).toBeNull();
  });
});

describe('extractSunatCode', () => {
  it('busca el primer grupo de 4 digitos en faultcode y faultstring', () => {
    expect(extractSunatCode('soap:Server', '0100 error interno')).toBe('0100');
    expect(extractSunatCode('0156', null)).toBe('0156');
    expect(extractSunatCode(null, null)).toBeNull();
    expect(extractSunatCode('sin codigo', 'tampoco')).toBeNull();
  });
});

describe('buildZipFileName', () => {
  it('arma el nombre que espera SUNAT sin ceros de relleno', () => {
    expect(
      buildZipFileName({
        ruc: '20123456789',
        tipoComprobante: '1',
        serie: 'f001',
        correlativo: 1,
      }),
    ).toBe('20123456789-01-F001-1.zip');
  });
});

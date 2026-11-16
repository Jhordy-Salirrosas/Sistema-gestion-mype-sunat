import { Injectable } from '@nestjs/common';
import { CertificateService } from '../../../sunat/certificate.service';
import { IssuerConfigResolver } from '../../../sunat/issuerConfigResolver';
import { SUNAT_BILL_SERVICE_URLS } from '../../../sunat/soap/soap.constants';
import { construirSobreGetStatus, parseGetStatusResponse } from '../../../sunat/soap/sunatSummaryOperations';
import { extractSunatCode, parseSendBillResponse } from '../../../sunat/soap/soap-envelope';

/** Solo getStatus con un ticket de diagnóstico, jamás sendBill/sendSummary.
 * Destino beta fijo y sin redirects: no admite URL ni secretos del cliente.
 */
@Injectable()
export class SunatConnectionTestService {
  constructor(private readonly resolver: IssuerConfigResolver, private readonly certificates: CertificateService) {}
  async test(companyId: string) {
    const started = Date.now();
    const result = { entorno: 'BETA' as const, conectado: false,
      credenciales: 'NO_VERIFICADAS', codigo: null as string | null,
      mensaje: 'No se pudo verificar la conexión beta.', latencia_ms: 0,
      certificado: { estado: 'INVALIDO', vence_el: null as string | null } };
    try {
      const context = await this.resolver.resolve(companyId);
      try {
        const certificate = this.certificates.inspectCertificate(context);
        result.certificado = { estado: certificate.validFrom.getTime() > Date.now() ? 'AUN_NO_VIGENTE'
          : certificate.validTo.getTime() < Date.now() ? 'VENCIDO' : 'VIGENTE', vence_el: certificate.validTo.toISOString() };
      } catch { result.certificado.estado = context.certificate ? 'INVALIDO' : 'NO_CONFIGURADO'; }
      if (!context.sol) { result.mensaje = 'Configure las credenciales SOL antes de probar la conexión beta.'; return result; }
      const body = construirSobreGetStatus({ ticket: '0000000000000', credentials: { usuario: context.sol.username, clave: context.sol.password } });
      const response = await fetch(SUNAT_BILL_SERVICE_URLS.beta, { method: 'POST', redirect: 'error',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"urn:oasis:names:specification:ubl:dsig:enveloped:xades"' },
        body, signal: AbortSignal.timeout(8000) });
      const xml = await response.text();
      const parsed = parseGetStatusResponse(xml);
      const fault = parseSendBillResponse(xml).fault;
      const code = extractSunatCode(fault?.faultCode, fault?.faultString);
      result.codigo = code ?? parsed.statusCode;
      if (code && ['0101','0102','0103','0104','0105','0106','0111','0112','0113'].includes(code)) {
        result.credenciales = 'RECHAZADAS'; result.mensaje = 'SUNAT beta rechazó las credenciales o el perfil SOL.';
      } else if (response.ok && !fault && ['0','98','99'].includes(parsed.statusCode ?? '')) {
        result.conectado = true; result.credenciales = 'VERIFICADAS_EN_BETA';
        result.mensaje = 'Conexión beta verificada mediante consulta de ticket. La vigencia del certificado se informa por separado.';
      } else {
        result.mensaje = 'SUNAT beta respondió, pero la respuesta no permite confirmar las credenciales. No se emitió ningún documento.';
      }
    } catch { result.mensaje = 'No se pudo completar el diagnóstico beta. Revise configuración, conectividad y disponibilidad de SUNAT.'; }
    finally { result.latencia_ms = Date.now() - started; }
    return result;
  }
}

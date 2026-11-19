import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ClientSafeHttpException } from '../../common/exceptions/clientSafeHttpException';
import { ConfigService } from '@nestjs/config';

export interface ConsultaDniResponse {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  fechaConsulta: string;
  source: string;
}

interface DniPayload {
  dni?: unknown;
  numero_documento?: unknown;
  numeroDocumento?: unknown;
  nombres?: unknown;
  apellido_paterno?: unknown;
  apellidoPaterno?: unknown;
  apellido_materno?: unknown;
  apellidoMaterno?: unknown;
  nombre_completo?: unknown;
  nombreCompleto?: unknown;
}

@Injectable()
export class DniConsultaService {
  private readonly logger = new Logger(DniConsultaService.name);

  constructor(private readonly config: ConfigService) {}

  async consultar(dniInput: string): Promise<ConsultaDniResponse> {
    const dni = (dniInput ?? '').trim();
    if (!/^\d{8}$/.test(dni)) {
      throw new BadRequestException({ code: 'DNI_INVALIDO', message: 'El DNI debe tener 8 dígitos.' });
    }
    const token = this.config.get<string>('DECOLECTA_DNI_API_TOKEN') ?? this.config.get<string>('DECOLECTA_API_TOKEN') ?? this.config.get<string>('SUNAT_RUC_SERVICE_API_KEY');
    if (!token) {
      throw new ClientSafeHttpException(503, 'Configure DECOLECTA_DNI_API_TOKEN o DECOLECTA_API_TOKEN para consultar DNI.');
    }
    const template = this.config.get<string>('DECOLECTA_DNI_API_URL')
      ?? 'https://api.decolecta.com/v1/reniec/dni?numero={dni}';
    const url = template.includes('{dni}') ? template.replace('{dni}', encodeURIComponent(dni)) : `${template.replace(/\/$/, '')}/${encodeURIComponent(dni)}`;
    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(this.config.get<number>('SUNAT_TIMEOUT_MS', 30000)) });
    } catch (error) {
      this.logger.warn(`Proveedor DNI no disponible: ${error instanceof Error ? error.message : String(error)}`);
      throw new ClientSafeHttpException(503, 'No fue posible conectar con el proveedor de DNI. Reintente en unos segundos.');
    }
    if (!response.ok) {
      if (response.status === 404 || response.status === 422) throw new BadRequestException({ code: 'DNI_NO_ENCONTRADO', message: 'El DNI no fue encontrado en RENIEC.' });
      if (response.status === 401 || response.status === 403) throw new ClientSafeHttpException(503, 'Decolecta rechazó el token: no tiene acceso a DNI o el plan no lo incluye.');
      if (response.status === 429) throw new ClientSafeHttpException(503, 'Se agotó el límite de consultas DNI de Decolecta. Intente más tarde.');
      throw new ClientSafeHttpException(503, 'El proveedor de DNI no respondió correctamente. Intente más tarde.');
    }
    const data = await response.json().catch(() => null) as DniPayload | null;
    if (!data || typeof data !== 'object') throw new ClientSafeHttpException(503, 'El proveedor de DNI devolvió una respuesta inválida.');
    const recibido = this.text(data.dni ?? data.numero_documento ?? data.numeroDocumento) || dni;
    if (recibido !== dni) throw new ClientSafeHttpException(503, 'La respuesta del proveedor no corresponde al DNI consultado.');
    const nombres = this.text(data.nombres);
    const apellidoPaterno = this.text(data.apellido_paterno ?? data.apellidoPaterno);
    const apellidoMaterno = this.text(data.apellido_materno ?? data.apellidoMaterno);
    const nombreCompleto = this.text(data.nombre_completo ?? data.nombreCompleto)
      || [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ').trim();
    if (!nombreCompleto) throw new ClientSafeHttpException(503, 'La respuesta del proveedor no contiene el nombre completo.');
    return { dni, nombres, apellidoPaterno, apellidoMaterno, nombreCompleto, fechaConsulta: new Date().toISOString(), source: 'decolecta' };
  }

  private text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
}

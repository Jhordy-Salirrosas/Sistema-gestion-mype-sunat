import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prismaService';
import { esRucValido } from '../invoices/domain/rules/taxpayerIdValidator';

export interface ConsultaRucResponse {
  ruc: string;
  razonSocial: string;
  estadoContribuyente: string;
  condicionDomicilio: string;
  ubigeo: string | null;
  direccionFiscal: string | null;
  esAgenteRetencion: boolean | null;
  fechaConsulta: string;
  source: string;
  cached: boolean;
}

interface RucProviderPayload {
  ruc?: unknown;
  numero_documento?: unknown;
  estado?: unknown;
  condicion?: unknown;
  direccion?: unknown;
  razonSocial?: unknown;
  razon_social?: unknown;
  estadoContribuyente?: unknown;
  estado_contribuyente?: unknown;
  condicionDomicilio?: unknown;
  condicion_domicilio?: unknown;
  ubigeo?: unknown;
  direccionFiscal?: unknown;
  direccion_fiscal?: unknown;
  esAgenteRetencion?: unknown;
  es_agente_retencion?: unknown;
}

interface NormalizedRucData {
  ruc: string;
  source: string;
  razonSocial: string;
  estadoContribuyente: string;
  condicionDomicilio: string;
  ubigeo: string | null;
  direccionFiscal: string | null;
  esAgenteRetencion: boolean | null;
}

@Injectable()
export class RucConsultaService {
  private readonly logger = new Logger(RucConsultaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async consultar(rucInput: string): Promise<ConsultaRucResponse> {
    const ruc = this.validarRuc(rucInput);
    const cached = await this.prisma.padronRucCache.findUnique({ where: { ruc } });
    const ttlSeconds = this.config.get<number>('SUNAT_RUC_CACHE_TTL_SECONDS', 86400);
    if (cached && Date.now() - cached.consulted_at.getTime() <= ttlSeconds * 1000) {
      return this.toResponse(cached, true);
    }

    const data = await this.consultarProveedor(ruc);
    const saved = await this.prisma.padronRucCache.upsert({
      where: { ruc },
      create: {
        ruc: data.ruc,
        razon_social: data.razonSocial,
        estado_contribuyente: data.estadoContribuyente,
        condicion_domicilio: data.condicionDomicilio,
        ubigeo: data.ubigeo,
        direccion_fiscal: data.direccionFiscal,
        es_agente_retencion: data.esAgenteRetencion,
        source: data.source,
        consulted_at: new Date(),
      },
      update: {
        razon_social: data.razonSocial,
        estado_contribuyente: data.estadoContribuyente,
        condicion_domicilio: data.condicionDomicilio,
        ubigeo: data.ubigeo,
        direccion_fiscal: data.direccionFiscal,
        es_agente_retencion: data.esAgenteRetencion,
        source: data.source,
        consulted_at: new Date(),
      },
    });
    return this.toResponse(saved, false);
  }

  private validarRuc(value: string): string {
    const ruc = value.trim();
    if (!esRucValido(ruc)) {
      throw new BadRequestException({
        code: 'RUC_INVALIDO',
        message: 'El RUC debe tener 11 dígitos y superar el Módulo 11 de SUNAT.',
      });
    }
    return ruc;
  }

  private proveedor(): 'decolecta' | 'generico' {
    const configurado = this.config.get<string>('SUNAT_RUC_PROVIDER')?.trim().toLowerCase();
    if (configurado === 'decolecta') return 'decolecta';
    if (configurado === 'generico' || configurado === 'generic') return 'generico';
    return this.config.get<string>('DECOLECTA_API_TOKEN') ? 'decolecta' : 'generico';
  }

  private async consultarProveedor(ruc: string): Promise<NormalizedRucData> {
    if (this.proveedor() === 'decolecta') return this.consultarDecolecta(ruc);

    const baseUrl = this.config.get<string>('SUNAT_RUC_SERVICE_URL');
    if (!baseUrl) {
      throw new ServiceUnavailableException({
        code: 'RUC_PROVIDER_NOT_CONFIGURED',
        message: 'El proveedor autorizado de consulta RUC no está configurado.',
      });
    }
    const url = baseUrl.includes('{ruc}')
      ? baseUrl.replace('{ruc}', encodeURIComponent(ruc))
      : `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(ruc)}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    const apiKey = this.config.get<string>('SUNAT_RUC_SERVICE_API_KEY');
    if (apiKey) headers['X-API-Key'] = apiKey;
    return this.normalizePayload(await this.fetchJson(url, headers), ruc, 'generico');
  }

  private async consultarDecolecta(ruc: string): Promise<NormalizedRucData> {
    const token = this.config.get<string>('DECOLECTA_API_TOKEN')
      ?? this.config.get<string>('SUNAT_RUC_SERVICE_API_KEY');
    if (!token) {
      throw new ServiceUnavailableException({
        code: 'RUC_PROVIDER_NOT_CONFIGURED',
        message: 'Configure DECOLECTA_API_TOKEN para consultar RUC con Decolecta.',
      });
    }
    const template = this.config.get<string>('DECOLECTA_API_URL')
      ?? 'https://api.decolecta.com/v1/sunat/ruc?numero={ruc}';
    const url = template.includes('{ruc}')
      ? template.replace('{ruc}', encodeURIComponent(ruc))
      : `${template.replace(/\/$/, '')}/${encodeURIComponent(ruc)}`;
    const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    return this.normalizePayload(await this.fetchJson(url, headers), ruc, 'decolecta');
  }

  private async fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('protocolo no permitido');
    } catch {
      throw new ServiceUnavailableException({
        code: 'RUC_PROVIDER_INVALID_URL',
        message: 'La URL del proveedor de RUC no tiene un formato válido.',
      });
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(this.config.get<number>('SUNAT_TIMEOUT_MS', 30000)),
      });
    } catch (error) {
      this.logger.warn(`Proveedor RUC no disponible: ${this.errorMessage(error)}`);
      throw new ServiceUnavailableException({
        code: 'RUC_PROVIDER_UNAVAILABLE',
        message: 'No fue posible consultar el proveedor de RUC.',
      });
    }
    if (!response.ok) {
      if (response.status === 404 || response.status === 422) {
        throw new BadRequestException({
          code: 'RUC_NO_ENCONTRADO',
          message: 'El proveedor no encontró el RUC consultado.',
        });
      }
      this.logger.warn(`Proveedor RUC respondió HTTP ${response.status}.`);
      throw new ServiceUnavailableException({
        code: 'RUC_PROVIDER_ERROR',
        message: 'El proveedor de RUC respondió con un error.',
      });
    }

    try {
      return await response.json();
    } catch {
      throw new ServiceUnavailableException({
        code: 'RUC_PROVIDER_INVALID_RESPONSE',
        message: 'El proveedor de RUC devolvió JSON inválido.',
      });
    }
  }

  private normalizePayload(payload: unknown, requestedRuc: string, source: string): NormalizedRucData {
    if (!payload || typeof payload !== 'object') {
      throw new ServiceUnavailableException({
        code: 'RUC_PROVIDER_INVALID_RESPONSE',
        message: 'La respuesta del proveedor de RUC no tiene un formato válido.',
      });
    }
    const data = payload as RucProviderPayload;
    const ruc = this.text(data.ruc) || this.text(data.numero_documento) || requestedRuc;
    const razonSocial = this.requiredText(data.razonSocial ?? data.razon_social, 'razón social');
    const estadoContribuyente = this.requiredText(
      data.estadoContribuyente ?? data.estado_contribuyente ?? data.estado,
      'estado del contribuyente',
    );
    const condicionDomicilio = this.requiredText(
      data.condicionDomicilio ?? data.condicion_domicilio ?? data.condicion,
      'condición del domicilio',
    );
    if (ruc !== requestedRuc || !esRucValido(ruc)) {
      throw new ServiceUnavailableException({
        code: 'RUC_PROVIDER_INVALID_RESPONSE',
        message: 'La respuesta del proveedor no corresponde al RUC consultado.',
      });
    }
    return {
      ruc,
      source,
      razonSocial,
      estadoContribuyente,
      condicionDomicilio,
      ubigeo: this.optionalText(data.ubigeo),
      direccionFiscal: this.optionalText(data.direccionFiscal ?? data.direccion_fiscal ?? (data as any).direccion),
      esAgenteRetencion: this.optionalBoolean(
        data.esAgenteRetencion ?? data.es_agente_retencion,
      ),
    };
  }

  private requiredText(value: unknown, field: string): string {
    const text = this.text(value);
    if (!text) {
      throw new ServiceUnavailableException({
        code: 'RUC_PROVIDER_INVALID_RESPONSE',
        message: `La respuesta del proveedor no contiene ${field}.`,
      });
    }
    return text;
  }

  private optionalText(value: unknown): string | null {
    const text = this.text(value);
    return text || null;
  }

  private text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private optionalBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'error desconocido';
  }

  private toResponse(
    row: {
      ruc: string;
      razon_social: string;
      estado_contribuyente: string;
      condicion_domicilio: string;
      ubigeo: string | null;
      direccion_fiscal: string | null;
      es_agente_retencion: boolean | null;
      consulted_at: Date;
      source: string;
    },
    cached: boolean,
  ): ConsultaRucResponse {
    return {
      ruc: row.ruc,
      razonSocial: row.razon_social,
      estadoContribuyente: row.estado_contribuyente,
      condicionDomicilio: row.condicion_domicilio,
      ubigeo: row.ubigeo,
      direccionFiscal: row.direccion_fiscal,
      esAgenteRetencion: row.es_agente_retencion,
      fechaConsulta: row.consulted_at.toISOString(),
      source: row.source,
      cached,
    };
  }
}

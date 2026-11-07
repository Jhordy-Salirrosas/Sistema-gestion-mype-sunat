import { API_BASE_URL } from '@/config/env.config';
import { useAuthStore } from '@/stores/authStore';
import type {
  CloseSirePeriodResponse,
  ImportSireProposalRequest,
  ImportSireProposalResponse,
  ReconcileScenario,
  ReconcileRequest,
  ReconcileResponse,
  SireHistoryResponse,
  TipoComprobante,
  SireAcceptRequest,
  SirePreliminaryRequest,
  SireRecordActionRequest,
  SireReplacementRequest,
  SireReportUploadRequest,
  SireWorkflowRequest,
  SireWorkflowResponse,
  SireProposalDto,
  SireExportResult,
} from '../types/sire.types';

export class SireApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'SireApiError';
    this.status = status;
  }
}

const getBackendMessage = (body: unknown): string | undefined => {
  if (typeof body !== 'object' || body === null) return undefined;
  const response = body as { message?: unknown; detail?: unknown; error?: unknown };
  const formatItem = (item: unknown): string => {
    if (typeof item === 'string') return item;
    if (typeof item !== 'object' || item === null) return '';
    const validation = item as {
      field?: unknown;
      message?: unknown;
      rule?: unknown;
    };
    if (typeof validation.message === 'string') return validation.message;
    if (typeof validation.field === 'string') {
      const fields: Record<string, string> = {
        period: 'período',
        ruc: 'RUC',
        comprobantes: 'comprobantes',
        tipoComprobante: 'tipo de comprobante',
        baseImponible: 'base imponible',
        igv: 'IGV',
        total: 'total',
      };
      const field = fields[validation.field] ?? validation.field;
      return `${field}: ${typeof validation.rule === 'string' ? validation.rule : 'dato inválido'}`;
    }
    return '';
  };

  if (typeof response.message === 'string') return response.message;
  if (Array.isArray(response.message)) {
    const messages = response.message.map(formatItem).filter(Boolean);
    if (messages.length) return messages.join(' • ');
  }
  if (typeof response.message === 'object' && response.message !== null) {
    const message = formatItem(response.message);
    if (message) return message;
  }
  if (typeof response.detail === 'string') return response.detail;
  if (typeof response.error === 'string') return response.error;
  if (typeof response.error === 'object' && response.error !== null) {
    const message = formatItem(response.error);
    if (message) return message;
  }
  return undefined;
};

const getSireStatusMessage = (status: number, detail?: string): string => {
  const messages: Record<number, string> = {
    400: 'Los datos enviados no son válidos. Revisa el periodo y la información del libro.',
    401: 'Tu sesión venció o no es válida. Inicia sesión nuevamente.',
    403: 'No tienes permisos para realizar esta operación SIRE.',
    404: 'No se encontró el recurso o periodo SIRE solicitado.',
    409: 'El periodo ya está cerrado y no admite cambios.',
    422: 'El backend rechazó la operación por una regla de negocio.',
    500: 'Ocurrió un error en el servidor al procesar la operación SIRE.',
    503: 'Módulo en modo mantenimiento. Contacte a sistemas.',
  };

  const message = messages[status] ?? 'No se pudo completar la operación SIRE.';
  return detail ? `${message} ${detail}` : message;
};

const workflowQuery = ({ period, bookType }: SireWorkflowRequest) =>
  new URLSearchParams({ periodo: period, libro: bookType }).toString();

const assertValidPeriod = (period: string) => {
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(period)) {
    throw new SireApiError('Ingresa un periodo válido con formato YYYYMM.', 400);
  }
};

const assertAllowedFile = (file: File, extensions: RegExp, label: string) => {
  if (!extensions.test(file.name) || file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new SireApiError(`Selecciona un archivo ${label} no vacío de máximo 5 MiB.`, 400);
  }
};

const proposalToRecord = (proposal: SireProposalDto) => ({
  proposalId: proposal.id,
  carSunat: proposal.carSunat,
  emitterRuc: proposal.emitterRuc,
  documentType: proposal.documentType,
  series: proposal.series,
  correlative: proposal.correlative,
  issueDate: proposal.issueDate,
  taxableBase: proposal.taxableBase,
  igvAmount: proposal.igvAmount,
  totalAmount: proposal.totalAmount,
  origin: proposal.origin,
  status: proposal.status,
  excluded: proposal.excluded,
});

const isProposalDto = (value: unknown): value is SireProposalDto =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'carSunat' in value &&
  typeof value.carSunat === 'string' &&
  'emitterRuc' in value &&
  typeof value.emitterRuc === 'string' &&
  'documentType' in value &&
  typeof value.documentType === 'string' &&
  'series' in value &&
  typeof value.series === 'string' &&
  'correlative' in value &&
  typeof value.correlative === 'string' &&
  'issueDate' in value &&
  typeof value.issueDate === 'string' &&
  'taxableBase' in value &&
  typeof value.taxableBase === 'number' &&
  'igvAmount' in value &&
  typeof value.igvAmount === 'number' &&
  'totalAmount' in value &&
  typeof value.totalAmount === 'number' &&
  'origin' in value &&
  (value.origin === 'SUNAT' || value.origin === 'USUARIO');

const normalizeWorkflow = (value: SireWorkflowResponse): SireWorkflowResponse => {
  if (Array.isArray(value.proposals)) {
    if (!value.proposals.every(isProposalDto)) {
      throw new SireApiError('El servidor devolvió propuestas SIRE con un formato inválido.', null);
    }
    return { ...value, records: value.proposals.map(proposalToRecord) };
  }
  return value;
};

const workflowRequest = async <T>(path: string, init: RequestInit): Promise<T> => {
  const token = useAuthStore.getState().token;
  if (!token) throw new SireApiError('Tu sesión venció o no es válida. Inicia sesión nuevamente.', 401);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...authenticatedHeaders(token, Boolean(init.body) && !(init.body instanceof FormData)),
        ...init.headers,
      },
    });
    const body = await readResponse<T>(response, getSireStatusMessage);
    return isWorkflowResponse(body) ? (normalizeWorkflow(body) as T) : body;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new SireApiError('No fue posible conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.', null);
    }
    throw error;
  }
};

const isWorkflowResponse = (value: unknown): value is SireWorkflowResponse =>
  typeof value === 'object' && value !== null && 'state' in value;

const actionBody = ({ proposalId, reason, period, bookType }: SireRecordActionRequest) => ({
  proposalId,
  period,
  bookType,
  reason,
});

const fileRequest = (payload: SireWorkflowRequest & { file: File }) => {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('period', payload.period);
  formData.append('bookType', payload.bookType);
  return formData;
};

interface BackendReconciliation {
  period: string;
  bookType: 'RVIE_VENTAS' | 'RCE_COMPRAS';
  totalLocalRecords: number;
  totalSireRecords: number;
  exactMatchesCount: number;
  discrepanciesCount: number;
  complianceRate: number;
  discrepancies: {
    discrepancyType: ReconcileScenario;
    emitterRuc: string;
    documentType: string;
    series: string;
    correlative: string;
    localTotalAmount?: number | null;
    sireTotalAmount?: number | null;
    amountDifference: number;
    taxableBaseDifference?: number | null;
    igvDifference?: number | null;
    duplicateSource?: 'LOCAL' | 'SIRE' | 'AMBOS' | null;
  }[];
}

const toTipoComprobante = (documentType: string): TipoComprobante => {
  if (documentType === '01' || documentType === '03' || documentType === '07' || documentType === '08') {
    return documentType;
  }
  throw new SireApiError('El servidor devolvió un tipo de comprobante desconocido.', null);
};

const mapReconciliation = (response: BackendReconciliation): ReconcileResponse => {
  const countByScenario = (scenario: ReconcileScenario) =>
    response.discrepancies.filter((item) => item.discrepancyType === scenario).length;

  return {
    period: response.period,
    bookType: response.bookType,
    summary: {
      total: Math.max(response.totalLocalRecords, response.totalSireRecords),
      coincidenciaExacta: response.exactMatchesCount,
      diferenciaMontos: countByScenario('DIFERENCIA_MONTOS'),
      omisionLocal: countByScenario('OMISION_LOCAL'),
      omisionSunat: countByScenario('OMISION_SUNAT'),
      duplicadoLlave: countByScenario('DUPLICADO_LLAVE'),
      porcentajeCumplimiento: response.complianceRate,
    },
    results: response.discrepancies.map((item) => ({
      llave: `${item.emitterRuc}-${item.documentType}-${item.series}-${item.correlative}`,
      tipoComprobante: toTipoComprobante(item.documentType),
      serie: item.series,
      correlativo: item.correlative,
      totalLocal: item.localTotalAmount ?? undefined,
      totalSire: item.sireTotalAmount ?? undefined,
      diferenciaTotal: item.amountDifference,
      diferenciaBase: item.taxableBaseDifference ?? 0,
      diferenciaIgv: item.igvDifference ?? 0,
      escenario: item.discrepancyType,
      duplicateSource: item.duplicateSource,
    })),
  };
};

const authenticatedHeaders = (token: string, json = false): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

const readResponse = async <T>(response: Response, message: (status: number, detail?: string) => string): Promise<T> => {
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      if (response.ok) {
        throw new SireApiError('El servidor devolvió una respuesta con formato inválido.', response.status);
      }
    } else {
      throw error;
    }
  }
  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/login?reason=session-expired');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
    throw new SireApiError(message(response.status, getBackendMessage(body)), response.status);
  }
  return body as T;
};

export const sireApi = {
  async getProposal(payload: SireWorkflowRequest) {
    assertValidPeriod(payload.period);
    const response = await workflowRequest<SireWorkflowResponse>('/sire/proposal', {
      method: 'POST',
      body: JSON.stringify({ period: payload.period, bookType: payload.bookType }),
    });
    if (!Array.isArray(response.proposals)) {
      throw new SireApiError('El servidor devolvió una respuesta de propuesta sin la lista de comprobantes.', null);
    }
    return response;
  },

  async importProposal(payload: ImportSireProposalRequest, file: File): Promise<ImportSireProposalResponse> {
    assertValidPeriod(payload.period);
    assertAllowedFile(file, /\.txt$/i, 'TXT');
    return workflowRequest<ImportSireProposalResponse>('/sire/import', {
      method: 'POST',
      body: fileRequest({ ...payload, file }),
    });
  },

  async uploadReport(payload: SireReportUploadRequest) {
    assertValidPeriod(payload.period);
    assertAllowedFile(payload.file, /\.(csv|xlsx)$/i, 'CSV o XLSX');
    return workflowRequest<SireWorkflowResponse>('/sire/upload', {
      method: 'POST',
      body: fileRequest(payload),
    });
  },

  async exclude(payload: SireRecordActionRequest) {
    assertValidPeriod(payload.period);
    return workflowRequest<SireWorkflowResponse>('/sire/excluir', {
      method: 'POST',
      body: JSON.stringify(actionBody(payload)),
    });
  },

  async restore(payload: SireRecordActionRequest) {
    assertValidPeriod(payload.period);
    return workflowRequest<SireWorkflowResponse>('/sire/restaurar', {
      method: 'POST',
      body: JSON.stringify(actionBody(payload)),
    });
  },

  async acceptProposal(payload: SireAcceptRequest) {
    assertValidPeriod(payload.period);
    return workflowRequest<SireWorkflowResponse>('/sire/aceptar', {
      method: 'POST',
      body: JSON.stringify({ period: payload.period, bookType: payload.bookType, confirmed: true }),
    });
  },

  async getPreliminary(payload: SireWorkflowRequest) {
    assertValidPeriod(payload.period);
    return workflowRequest<SireWorkflowResponse>(`/sire/preliminar?${workflowQuery(payload)}`, { method: 'GET' });
  },

  async registerPreliminary(payload: SirePreliminaryRequest) {
    assertValidPeriod(payload.period);
    return workflowRequest<SireWorkflowResponse>('/sire/preliminar', {
      method: 'POST',
      body: JSON.stringify({ period: payload.period, bookType: payload.bookType, records: payload.records }),
    });
  },

  async removePreliminaryRecord(payload: SireRecordActionRequest) {
    assertValidPeriod(payload.period);
    return workflowRequest<SireWorkflowResponse>('/sire/preliminary', {
      method: 'DELETE',
      body: JSON.stringify({ period: payload.period, bookType: payload.bookType, proposalId: payload.proposalId }),
    });
  },

  async replaceProposal(payload: SireReplacementRequest) {
    assertValidPeriod(payload.period);
    assertAllowedFile(payload.file, /\.txt$/i, 'TXT');
    return workflowRequest<SireWorkflowResponse>('/sire/proposal/replace', {
      method: 'POST',
      body: fileRequest(payload),
    });
  },

  async getGenerated(payload: SireWorkflowRequest) {
    assertValidPeriod(payload.period);
    return workflowRequest<SireWorkflowResponse>(`/sire/generado?${workflowQuery(payload)}`, { method: 'GET' });
  },

  async pollTicket(payload: SireWorkflowRequest) {
    assertValidPeriod(payload.period);
    return workflowRequest<SireWorkflowResponse>(`/sire/tickets/${encodeURIComponent(payload.period)}/poll?${new URLSearchParams({ bookType: payload.bookType })}`, {
      method: 'POST',
    });
  },

  async getStatus(payload: SireWorkflowRequest) {
    return this.pollTicket(payload);
  },

  async generate(payload: SireWorkflowRequest) {
    assertValidPeriod(payload.period);
    return workflowRequest<SireWorkflowResponse>('/sire/generate', {
      method: 'POST',
      body: JSON.stringify({ period: payload.period, bookType: payload.bookType }),
    });
  },

  async export(payload: SireWorkflowRequest): Promise<SireExportResult> {
    assertValidPeriod(payload.period);
    const token = useAuthStore.getState().token;
    if (!token) throw new SireApiError('Tu sesión venció o no es válida. Inicia sesión nuevamente.', 401);
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/sire/export`, {
        method: 'POST',
        headers: authenticatedHeaders(token, true),
        body: JSON.stringify({ period: payload.period, bookType: payload.bookType }),
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new SireApiError('No fue posible conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.', null);
      }
      throw error;
    }

    if (!response.ok) {
      await readResponse<unknown>(response, getSireStatusMessage);
    }
    if (response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return { kind: 'response', body: await readResponse<unknown>(response, getSireStatusMessage) };
    }

    const blob = await response.blob();
    if (!blob.size) throw new SireApiError('El servidor devolvió un archivo de exportación vacío.', response.status);
    const disposition = response.headers.get('content-disposition') ?? '';
    const filename = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)?.[1]?.replace(/"/g, '')
      ?? `sire-export-${payload.period}-${payload.bookType}`;
    return { kind: 'file', blob, filename };
  },

  async closePeriod(period: string, bookType: 'RVIE_VENTAS' | 'RCE_COMPRAS'): Promise<CloseSirePeriodResponse> {
    assertValidPeriod(period);
    return workflowRequest<CloseSirePeriodResponse>('/sire/close', {
      method: 'POST',
      body: JSON.stringify({ period, bookType }),
    });
  },

  async reconcile(payload: ReconcileRequest): Promise<ReconcileResponse> {
    const token = useAuthStore.getState().token;
    if (!token) {
      throw new SireApiError('Tu sesión venció o no es válida. Inicia sesión nuevamente.', 401);
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/sire/reconcile`, {
        method: 'POST',
        headers: authenticatedHeaders(token, true),
        body: JSON.stringify({
          period: payload.period,
          bookType: payload.bookType,
          localRecords: payload.comprobantes.map((item) => ({
            emitterRuc: payload.ruc,
            documentType: item.tipoComprobante,
            series: item.serie,
            correlative: item.correlativo,
            taxableBase: item.baseImponible,
            igvAmount: item.igv,
            totalAmount: item.total,
          })),
        }),
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new SireApiError(
          'No fue posible conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.',
          null,
        );
      }
      throw error;
    }

    const body = await readResponse<BackendReconciliation>(response, getSireStatusMessage);
    return mapReconciliation(body);
  },

  async getHistory(page = 1, limit = 20): Promise<SireHistoryResponse> {
    const token = useAuthStore.getState().token;
    if (!token) {
      throw new SireApiError('Tu sesión venció o no es válida. Inicia sesión nuevamente.', 401);
    }
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/sire/history?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: authenticatedHeaders(token),
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new SireApiError('No fue posible conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.', null);
      }
      throw error;
    }
    return readResponse<SireHistoryResponse>(response, getSireStatusMessage);
  },
};

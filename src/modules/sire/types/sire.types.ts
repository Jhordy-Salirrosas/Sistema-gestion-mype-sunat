export type ReconcileScenario =
  | 'COINCIDENCIA_EXACTA'
  | 'DIFERENCIA_MONTOS'
  | 'OMISION_LOCAL'
  | 'OMISION_SUNAT'
  | 'DUPLICADO_LLAVE';

export type DuplicateSource = 'LOCAL' | 'SIRE' | 'AMBOS';
export type TipoComprobante = '01' | '03' | '07' | '08';
export type SireBookType = 'RVIE_VENTAS' | 'RCE_COMPRAS';
export type SireWorkflowState =
  | 'PROPUESTA'
  | 'PROCESANDO_REEMPLAZO'
  | 'PROCESANDO_PRELIMINAR'
  | 'CON_PRELIMINAR'
  | 'PROCESANDO_GENERACION'
  | 'GENERADO'
  | 'ERROR';
export type SireTicketStatus = 'PENDIENTE' | 'TERMINADO' | 'ERROR';
export type SireRecordOrigin = 'SUNAT' | 'USUARIO';

export interface SireWorkflowRecord {
  proposalId: string;
  carSunat: string;
  emitterRuc: string;
  documentType: TipoComprobante;
  series: string;
  correlative: string;
  issueDate: string;
  taxableBase: number;
  igvAmount: number;
  totalAmount: number;
  origin: SireRecordOrigin;
  status?: string;
  excluded?: boolean;
}

export interface SireProposalDto {
  id: string;
  period: string;
  bookType: 'RVIE' | 'RCE' | SireBookType;
  carSunat: string;
  emitterRuc: string;
  documentType: TipoComprobante;
  series: string;
  correlative: string;
  issueDate: string;
  taxableBase: number;
  igvAmount: number;
  totalAmount: number;
  origin: SireRecordOrigin;
  status?: string;
  excluded?: boolean;
}

export interface SireWorkflowResponse {
  ruc?: string;
  period: string;
  bookType: SireBookType | 'RVIE' | 'RCE';
  state: SireWorkflowState;
  ticket?: string | null;
  status?: SireTicketStatus;
  count?: number;
  proposals?: SireProposalDto[];
  records?: SireWorkflowRecord[];
  error?: { code: string; message: string; details?: string } | null;
}

export interface SireWorkflowRequest {
  ruc?: string;
  period: string;
  bookType: SireBookType;
}

export interface SireRecordActionRequest extends SireWorkflowRequest {
  proposalId: string;
  reason?: string;
}

export interface SireAcceptRequest extends SireWorkflowRequest {
  confirmed: true;
}

export interface SirePreliminaryRequest extends SireWorkflowRequest {
  records: SireWorkflowRecord[];
}

export interface SireTicketPollRequest {
  period: string;
  bookType: SireBookType;
}

export interface SireReplacementRequest extends SireWorkflowRequest {
  file: File;
}

export interface SireReportUploadRequest extends SireWorkflowRequest {
  file: File;
}

export type SireExportResult =
  | { kind: 'file'; blob: Blob; filename: string }
  | { kind: 'response'; body: unknown };

export interface ImportSireProposalRequest {
  period: string;
  bookType: SireBookType;
}

export interface ImportSireProposalResponse {
  imported: number;
  rejected: number;
  errors: { line: number; reason: string }[];
}

export interface SireComprobante {
  tipoComprobante: TipoComprobante;
  serie: string;
  correlativo: string;
  baseImponible: number;
  igv: number;
  total: number;
}

export interface ComprobanteDraft extends Omit<SireComprobante, 'baseImponible' | 'igv' | 'total'> {
  baseImponible: string;
  igv: string;
  total: string;
}

export interface ReconcileRequest {
  period: string;
  ruc: string;
  bookType: SireBookType;
  comprobantes: SireComprobante[];
}

export interface ReconcileSummary {
  total: number;
  coincidenciaExacta: number;
  diferenciaMontos: number;
  omisionLocal: number;
  omisionSunat: number;
  duplicadoLlave: number;
  porcentajeCumplimiento: number;
}

export interface ReconcileResult {
  llave: string;
  tipoComprobante: TipoComprobante;
  serie: string;
  correlativo: string;
  totalLocal?: number;
  totalSire?: number;
  diferenciaTotal: number;
  diferenciaBase: number;
  diferenciaIgv: number;
  escenario: ReconcileScenario;
  duplicateSource?: DuplicateSource | null;
}

export interface ReconcileResponse {
  period: string;
  bookType: SireBookType;
  summary: ReconcileSummary;
  results: ReconcileResult[];
}

export interface SireHistoryItem {
  id: string;
  period: string;
  bookType: 'RVIE' | 'RCE';
  status: 'EN_REVISION' | 'CONCILIADO' | 'CERRADO';
  createdAt: string;
  complianceRate: number;
  totalsByScenario: Record<ReconcileScenario, number>;
}

export interface SireHistoryResponse {
  page: number;
  limit: number;
  total: number;
  items: SireHistoryItem[];
}

export interface SireDashboardMetrics {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  recentFailedCalls: number;
  failureRate: number;
  slowCallRate: number;
  bufferedInvoicesCount: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalRetries: number;
  lastStateChange: string;
  circuitBreakerScope: string;
  activityScope: string;
  mttdSeconds: number | null;
  mttrSeconds: number | null;
  mtbfSeconds: number | null;
  mttd?: number | null;
  mttr?: number | null;
  mtbf?: number | null;
}

export type SireDashboardGranularity = 'minute' | 'hour' | 'day';

export interface SireDashboardHistoryPoint {
  timestamp: string;
  retries: number;
  availabilityPercent: number | null;
  observedCalls: number;
  successfulCalls: number;
  failedCalls: number;
}

export interface SireDashboardHistoryResponse {
  points: SireDashboardHistoryPoint[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface SireDashboardHistoryRequest {
  start: string;
  end: string;
  granularity: SireDashboardGranularity;
  limit: number;
  offset: number;
}

export interface CloseSirePeriodResponse {
  period: string;
  bookType: SireBookType;
  status: 'CERRADO';
}

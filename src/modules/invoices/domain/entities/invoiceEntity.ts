export interface InvoiceEntityProps {
  id?: string;
  company_id: string;
  ruc_emisor: string;
  serie: string;
  correlativo: number;
  tipo_comprobante: string;
  monto_total: number;
  fecha_emision: Date;
  payload_ubl: Record<string, unknown>;
  estado?: string;
  created_at?: Date;
  /**
   * Huella del comprobante para reconocer un reenvío (TA-32). No es una
   * columna de la base: el repositorio la usa solo para registrar en el log
   * qué petición provocó un choque con `uq_invoices_idempotencia`.
   */
  clave_idempotencia?: string;
}

export class InvoiceEntity {
  public readonly id?: string;
  public readonly company_id: string;
  public readonly ruc_emisor: string;
  public readonly serie: string;
  public readonly correlativo: number;
  public readonly tipo_comprobante: string;
  public readonly monto_total: number;
  public readonly fecha_emision: Date;
  public readonly payload_ubl: Record<string, unknown>;
  public readonly estado: string;
  public readonly created_at?: Date;
  /** Huella del comprobante para reconocer un reenvío (TA-32). */
  public readonly clave_idempotencia?: string;

  constructor(props: InvoiceEntityProps) {
    this.id = props.id;
    this.company_id = props.company_id;
    this.ruc_emisor = props.ruc_emisor;
    this.serie = props.serie;
    this.correlativo = props.correlativo;
    this.tipo_comprobante = props.tipo_comprobante;
    this.monto_total = props.monto_total;
    this.fecha_emision = props.fecha_emision;
    this.payload_ubl = props.payload_ubl;
    this.estado = props.estado ?? 'PENDIENTE_ENVIO';
    this.created_at = props.created_at;
    this.clave_idempotencia = props.clave_idempotencia;
  }
}

export interface InvoiceEntityProps {
  auditoria_retencion?: string;
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
  /**
   * Datos del adquirente.
   *
   * La tabla `invoices` tiene columnas propias para ellos y la pantalla las lee
   * de ahí: sin ellas la bandeja mostraba "CLIENTE SIN NOMBRE" en comprobantes
   * que sí llevaban el cliente dentro del `payload_ubl`. Se detectó revisando
   * la grilla en el navegador el 31-10.
   */
  customer_identity_type?: string;
  customer_identity_number?: string;
  customer_legal_name?: string;
  /**
   * Referencia de la nota de crédito/débito al documento que afecta.
   *
   * Son columnas propias de `invoices` y la bandeja las consulta; dejarlas en
   * NULL hacía que una nota aceptada se mostrara sin origen ni motivo aunque el
   * XML los contuviera.
   */
  referenced_document_type?: string;
  referenced_series_correlative?: string;
  /**
   * UUID del comprobante afectado (TA-66).
   *
   * Es la clave por la que se suman las notas anteriores para calcular el saldo
   * devolvible; el número (`referenced_series_correlative`) es lo que se muestra
   * y lo que viaja en el XML, pero no identifica una fila.
   */
  referenced_invoice_id?: string;
  credit_debit_reason_code?: string;
}

export class InvoiceEntity {
  public readonly auditoria_retencion?: string;
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
  /** Datos del adquirente, para la bandeja y el PDF. */
  public readonly customer_identity_type?: string;
  public readonly customer_identity_number?: string;
  public readonly customer_legal_name?: string;
  /** Referencia al documento afectado (solo notas 07 y 08). */
  public readonly referenced_document_type?: string;
  public readonly referenced_series_correlative?: string;
  /** UUID del comprobante afectado: clave del control de saldo (TA-66). */
  public readonly referenced_invoice_id?: string;
  public readonly credit_debit_reason_code?: string;

  constructor(props: InvoiceEntityProps) {
    this.auditoria_retencion = props.auditoria_retencion;
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
    this.customer_identity_type = props.customer_identity_type;
    this.customer_identity_number = props.customer_identity_number;
    this.customer_legal_name = props.customer_legal_name;
    this.referenced_document_type = props.referenced_document_type;
    this.referenced_series_correlative = props.referenced_series_correlative;
    this.referenced_invoice_id = props.referenced_invoice_id;
    this.credit_debit_reason_code = props.credit_debit_reason_code;
  }
}

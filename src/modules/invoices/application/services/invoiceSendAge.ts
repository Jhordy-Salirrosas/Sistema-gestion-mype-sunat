import { fechaFiscalLima } from '../../fiscalDate';
import type { GravedadAlerta } from './invoiceAlertService';

export const ESTADOS_PLAZO_ENVIO = ['PENDIENTE', 'EN_COLA', 'PROCESANDO', 'ENVIADO', 'ERROR_RED', 'RECHAZADO'] as const;
export interface DocumentoPlazoEnvio {
  id: string; numero: string; tipoComprobante: string; estado: string;
  fechaEmision: string; fechaLimite: string; diasRestantes: number;
}
export interface AlertaAntiguedadEnvio {
  evaluado: boolean; gravedad: GravedadAlerta; mensaje: string; documentos: DocumentoPlazoEnvio[];
}
interface Fila { id: string; tipo_comprobante: string; serie: string; correlativo: number; estado: string; fecha_emision: Date }

/** Días civiles: la fecha persistida no se convierte de UTC a Lima. */
export function calcularAntiguedadEnvio(filas: readonly Fila[], hoy = fechaFiscalLima()): AlertaAntiguedadEnvio {
  const documentos = filas.filter(f => ['01', '03'].includes(f.tipo_comprobante) && (ESTADOS_PLAZO_ENVIO as readonly string[]).includes(f.estado)).map(f => {
    const fechaEmision = f.fecha_emision.toISOString().slice(0, 10);
    const limite = new Date(`${fechaEmision}T00:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + (f.tipo_comprobante === '01' ? 3 : 7));
    return { id: f.id, numero: `${f.serie}-${String(f.correlativo).padStart(8, '0')}`, tipoComprobante: f.tipo_comprobante, estado: f.estado,
      fechaEmision, fechaLimite: limite.toISOString().slice(0, 10), diasRestantes: Math.round((limite.getTime() - Date.parse(`${hoy}T00:00:00Z`)) / 86400000) };
  }).sort((a, b) => a.diasRestantes - b.diasRestantes || a.fechaEmision.localeCompare(b.fechaEmision) || a.id.localeCompare(b.id));
  return { evaluado: true, gravedad: !documentos.length ? 'OK' : documentos[0].diasRestantes <= 1 ? 'CRITICO' : 'AVISO',
    mensaje: documentos.length ? `${documentos.length} comprobante(s) pendientes o en error, ordenados por fecha límite de envío.` : 'No hay facturas ni boletas pendientes o en error.', documentos };
}

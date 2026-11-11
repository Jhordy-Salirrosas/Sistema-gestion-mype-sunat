export interface SeleccionBaja { id: string; motivo: string; }
export interface AgregadoFiscal { bridge_reversal?: { pending: number; done: number }; id: string; kind: 'RA' | 'RC'; identifier: string; reference_date: string; state: string; ticket: string | null; transport_uncertain: boolean; error: string | null; result: { codigo?: string; mensaje?: string; referencia?: string } | null; }

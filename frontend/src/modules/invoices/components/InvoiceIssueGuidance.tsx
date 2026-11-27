import { CircleAlert } from 'lucide-react';
import { orientacionError } from '../lib/invoiceErrorGuidance';
export function InvoiceIssueGuidance({ codigo, motivo }: { codigo?: string | null; motivo?: string | null }) {
 const guia = orientacionError(codigo);
 return <div className="space-y-1 text-sm"><p className="flex items-start gap-1"><CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{guia.mensaje}</p>
  <p>{guia.accion}</p>{motivo && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">Motivo informado: {motivo}</p>}
  {codigo && <details><summary className="min-h-6 cursor-pointer">Ver detalle técnico</summary><p>Código: {codigo}</p></details>}
 </div>;
}

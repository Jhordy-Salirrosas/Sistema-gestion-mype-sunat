import { CircleAlert, Info } from 'lucide-react';
export interface InvoiceNotice { priority: number; title: string; text: string; }
export function InvoicePriorityNotice({ notices }: { notices: Array<InvoiceNotice | null | undefined | false> }) {
 const elegibles=notices.filter((n):n is InvoiceNotice=>Boolean(n)).sort((a,b)=>b.priority-a.priority);
 const aviso=elegibles[0]; if(!aviso)return null;
 const Icono=aviso.priority>=80?CircleAlert:Info;
 return <section className="m1-banner rounded-lg border p-4" role={aviso.priority>=80?'alert':'status'} aria-label="Aviso prioritario">
  <h2 className="flex items-center gap-2 font-semibold"><Icono aria-hidden="true" className="h-5 w-5" />{aviso.title}</h2><p>{aviso.text}</p>
  {elegibles.length>1&&<details className="mt-2"><summary className="cursor-pointer text-sm">Otros avisos ({elegibles.length-1})</summary>{elegibles.slice(1).map((n,i)=><p key={i} className="text-sm">{n.title}: {n.text}</p>)}</details>}
 </section>;
}

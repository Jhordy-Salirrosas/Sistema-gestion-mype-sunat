import { CircleAlert } from 'lucide-react';
import type { RefObject } from 'react';
import type { FormIssue } from '../lib/invoiceFormIssues';
export function InlineInvoiceError({ mensaje, id }: {mensaje?: string;id?:string}) {
 return mensaje?<p id={id} className="flex items-start gap-1 text-xs text-destructive" role="alert"><CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/>{mensaje}</p>:null;
}
export function InvoiceErrorSummary({issues,formRef,summaryRef}:{issues:FormIssue[];formRef:RefObject<HTMLFormElement|null>;summaryRef:RefObject<HTMLDivElement|null>}) {
 return <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="emision-errores" className="rounded-lg border border-destructive p-4 lg:col-span-2">
  <h2 id="emision-errores" className="flex items-center gap-2 font-semibold"><CircleAlert aria-hidden="true" className="h-5 w-5"/>Revise los campos indicados</h2>
  <ul className="mt-2 space-y-1">{issues.map((issue,i)=><li key={`${issue.selector}-${i}`}><a className="underline" href="#emision-errores" onClick={e=>{e.preventDefault();const campo=formRef.current?.querySelector<HTMLElement>(issue.selector);campo?.scrollIntoView?.({block:'center'});campo?.focus();}}>{issue.mensaje}</a></li>)}</ul>
 </div>;
}

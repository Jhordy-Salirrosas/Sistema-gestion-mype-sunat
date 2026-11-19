import { useState, type FocusEvent } from 'react';
import type { FormIssue } from '../lib/invoiceFormIssues';
export function useInvoiceBlur(issues:FormIssue[]) {
 const [tocados,setTocados]=useState<string[]>([]);
 const [enviado,setEnviado]=useState(false);
 const [editando,setEditando]=useState<string[]>([]);
 const capturar=(e:FocusEvent<HTMLFormElement>,marcar:boolean)=>{
  const target=e.target as HTMLElement;
  const selectores=issues.filter(i=>(target.matches(i.selector)||Boolean(target.closest(i.selector)))).map(i=>i.selector);
  setEditando(marcar?[]:selectores);
  setTocados(prev=>marcar?[...new Set([...prev,...selectores])]:prev.filter(s=>!(target.matches(s)||target.closest(s))));
 };
 return {enviado,mostrar:()=>setEnviado(true),alSalir:(e:FocusEvent<HTMLFormElement>)=>capturar(e,true),alEntrar:(e:FocusEvent<HTMLFormElement>)=>capturar(e,false),mensaje:(selector:string)=>!editando.includes(selector)&&(enviado||tocados.includes(selector))?issues.find(i=>i.selector===selector)?.mensaje:undefined};
}

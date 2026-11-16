import { useAuthStore } from '@/stores/authStore';
/** Respuestas del servidor simuladas para pruebas de otros flujos, nunca defaults de producción. */
function role(){const value=useAuthStore.getState().user?.role;return value==='OPERATOR'?'OPERADOR_FACTURACION':value==='ACCOUNTANT'?'CONTADOR':value;}
export function serverModules(){
 const current=role();
 return Array.from({length:10},(_,i)=>`M${i+1}`).map(moduleCode=>{
  const view=current==='ADMIN'||current==='AUDITOR'||current==='CONTADOR'&&moduleCode!=='M9'||current==='OPERADOR_FACTURACION'&&['M1','M6','M7','M10'].includes(moduleCode)||current==='OPERADOR_ADUANAS'&&['M2','M6','M8'].includes(moduleCode);
  const write=current==='ADMIN'||current==='CONTADOR'&&moduleCode!=='M9'||current==='OPERADOR_FACTURACION'&&['M1','M7'].includes(moduleCode)||current==='OPERADOR_ADUANAS'&&['M2','M6','M8'].includes(moduleCode);
  return {role:current??'',moduleCode,canView:Boolean(view),canWrite:Boolean(write)};
 });
}
export function serverActions(){
 const current=role();return ['INVOICE_EDIT_ISSUE_DATE','INVOICE_FORCE_RESEND','INVOICE_RESOLVE_DLQ','INVOICE_REPROCESS_BRIDGE'].map(actionCode=>({role:current??'',actionCode,allowed:current==='ADMIN'||current==='OPERADOR_FACTURACION'&&actionCode==='INVOICE_RESOLVE_DLQ'}));
}

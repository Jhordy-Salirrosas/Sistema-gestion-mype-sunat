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

import technical from './dynamicPermissions.json';
const SYSTEM=['ADMIN','CONTADOR','OPERADOR_FACTURACION','OPERADOR_ADUANAS','AUDITOR'];
const NAMES:Record<string,string>={ADMIN:'Administrador',CONTADOR:'Contador',OPERADOR_FACTURACION:'Operador de facturación',OPERADOR_ADUANAS:'Operador de aduanas',AUDITOR:'Auditor'};
export const TEST_ACTIONS=technical.actions.map(a=>[a.code,a.name] as const);
export const TEST_ROLES=SYSTEM;
export const serverRoleRows=()=>SYSTEM.map(code=>({code,name:NAMES[code],isSystem:true}));
export const serverCatalog=()=>({actions:technical.actions,menus:technical.menus});
export const serverMenuRows=()=>SYSTEM.flatMap(role=>technical.menus.map(m=>({role,menuCode:m.code,canView:m.roles.includes(role)})));
export function serverSnapshot(){
 const current=role()??'';const modules=serverModules();
 const actions=technical.actions.map(a=>({role:current,actionCode:a.code,allowed:a.roles.includes(current),available:SYSTEM.includes(current)&&(!a.reservedAdmin||current==='ADMIN')&&(a.accessGate?Boolean(technical.actions.find(d=>d.code===a.accessGate)?.roles.includes(current)):a.roles.includes(current))}));
 const menus=technical.menus.map(m=>({...m,canView:m.roles.includes(current)&&Boolean(modules.find(row=>row.moduleCode===m.moduleCode)?.canView)}));
 const preferred=current==='CONTADOR'?'/accounting':current==='OPERADOR_ADUANAS'?'/customs':'/invoices/dashboard';
 return {ui:{showDuaCreation:['ADMIN','OPERADOR_ADUANAS'].includes(current),showAccountingCreation:['ADMIN','CONTADOR'].includes(current)},role:{code:current,name:NAMES[current]??current,isSystem:SYSTEM.includes(current)},modules,actions,menus,homePath:menus.find(m=>m.canView&&m.path===preferred)?.path??menus.find(m=>m.canView)?.path??null,customRolesEnabled:false};
}

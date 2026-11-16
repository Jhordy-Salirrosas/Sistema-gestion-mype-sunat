import { useServerPermissions } from '@/modules/auth/hooks/useServerPermissions';
/** Fachada compatible para pantallas existentes. Capacidades efectivas del servidor. */
export function useRolePermissions(){
 const p=useServerPermissions();
 return {
  canEmitInvoices:p.canWrite('M1')&&p.canAction('INVOICE_EMIT'),
  canRegisterDua:Boolean(p.snapshot?.ui?.showDuaCreation),
  canCreateAccountingEntry:Boolean(p.snapshot?.ui?.showAccountingCreation),
  canExportPle:p.canWrite('M4'),canReconcileSire:p.canWrite('M3'),
  isReadOnly:!p.canWrite('M2'),isAuditor:p.ready&&!p.canWrite('M2'),
 };
}

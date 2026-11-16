/** Catálogo técnico versionado. El nombre visible de un rol nunca concede permisos. */
export const SYSTEM_ROLES = ['ADMIN', 'CONTADOR', 'OPERADOR_FACTURACION', 'OPERADOR_ADUANAS', 'AUDITOR'] as const;
export const SYSTEM_ROLE_NAMES: Record<string, string> = { ADMIN: 'Administrador', CONTADOR: 'Contador', OPERADOR_FACTURACION: 'Operador de facturación', OPERADOR_ADUANAS: 'Operador de aduanas', AUDITOR: 'Auditor' };
export const CAPABILITIES = [
  {"code": "INVOICE_EDIT_ISSUE_DATE", "name": "Modificar fecha de emisión", "roles": ["ADMIN"], "systemCeiling": null, "reservedAdmin": false},
  {"code": "INVOICE_FORCE_RESEND", "name": "Reenvío forzado", "roles": ["ADMIN"], "systemCeiling": ["ADMIN"], "reservedAdmin": false},
  {"code": "INVOICE_RESOLVE_DLQ", "name": "Resolver DLQ", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "systemCeiling": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false},
  {"code": "INVOICE_REPROCESS_BRIDGE", "name": "Reprocesar puente", "roles": ["ADMIN"], "systemCeiling": ["ADMIN"], "reservedAdmin": false},
  {"code": "INVOICE_EMIT", "name": "Emitir comprobantes", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "systemCeiling": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false},
  {"code": "INVOICE_SUMMARY_SEND", "name": "Enviar resúmenes y bajas", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "systemCeiling": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false},
  {"code": "INVOICE_SUNAT_POLL", "name": "Consultar estado SUNAT", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "systemCeiling": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false},
  {"code": "INVOICE_RETRY_CDR", "name": "Reintentar CDR", "roles": ["ADMIN"], "systemCeiling": ["ADMIN"], "reservedAdmin": false},
  {"code": "INVOICE_NOTES_ISSUE", "name": "Emitir notas", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "systemCeiling": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false},
  {"code": "INVOICE_DETRACTION_REGISTER", "name": "Registrar depósitos de detracción", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "systemCeiling": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false},
  {"code": "INVOICE_BATCH_RETRY", "name": "Reenvío masivo", "roles": ["ADMIN"], "systemCeiling": ["ADMIN"], "reservedAdmin": false},
  {"code": "INVOICE_ACCOUNTING_REGULARIZE", "name": "Regularizar contabilidad", "roles": ["ADMIN"], "systemCeiling": ["ADMIN"], "reservedAdmin": false},
  {"code": "INVOICE_CONFIG_EDIT", "name": "Administrar configuración y series", "roles": ["ADMIN"], "systemCeiling": ["ADMIN"], "reservedAdmin": true},
  {"code": "INVOICE_XML_REPAIR", "name": "Descargar XML con reparación", "roles": ["ADMIN", "CONTADOR", "OPERADOR_FACTURACION", "OPERADOR_ADUANAS"], "systemCeiling": ["ADMIN", "CONTADOR", "OPERADOR_FACTURACION", "OPERADOR_ADUANAS"], "reservedAdmin": false},
  {"code": "CUSTOMS_CREATE_DUA", "name": "Crear declaración aduanera", "roles": ["ADMIN", "OPERADOR_ADUANAS"], "systemCeiling": ["ADMIN", "OPERADOR_ADUANAS"], "reservedAdmin": false},
  {"code": "ACCOUNTING_ENTRY_CREATE", "name": "Crear asiento contable", "roles": ["ADMIN", "CONTADOR"], "systemCeiling": ["ADMIN", "CONTADOR"], "reservedAdmin": false},
  {"code": "INVENTORY_ADJUST", "name": "Ajustar inventario", "roles": ["ADMIN"], "systemCeiling": ["ADMIN"], "reservedAdmin": false},
  {"code": "INVENTORY_TRANSFER", "name": "Transferir inventario", "roles": ["ADMIN"], "systemCeiling": ["ADMIN"], "reservedAdmin": false},
] as const;
export type CapabilityCode = typeof CAPABILITIES[number]['code'];

/** Compatibilidad de los cinco roles: un override no elimina las restricciones
 * históricas de acceso. EDIT_ISSUE_DATE sí era delegable mediante override. */
export function capabilityAllowed(role: string, code: string, override?: boolean, customEnabled = false): boolean {
  const definition = CAPABILITIES.find(row => row.code === code);
  if (!definition) return false;
  const system = (SYSTEM_ROLES as readonly string[]).includes(role);
  if (!system && !customEnabled) return false;
  if (definition.reservedAdmin && role !== 'ADMIN') return false;
  if (system && definition.systemCeiling && !(definition.systemCeiling as readonly string[]).includes(role)) return false;
  return override ?? (definition.roles as readonly string[]).includes(role);
}

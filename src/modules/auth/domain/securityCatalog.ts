/** Catálogo técnico versionado. El nombre visible de un rol nunca concede permisos. */
export const SYSTEM_ROLES = ['ADMIN', 'CONTADOR', 'OPERADOR_FACTURACION', 'OPERADOR_ADUANAS', 'AUDITOR'] as const;
// Los alias legacy se reservan; nunca se crean como roles de empresa.
export const RESERVED_ROLE_CODES: readonly string[] = [...SYSTEM_ROLES, 'ACCOUNTANT', 'OPERATOR'];
export const SYSTEM_ROLE_NAMES: Record<string, string> = { ADMIN: 'Administrador', CONTADOR: 'Contador', OPERADOR_FACTURACION: 'Operador de facturación', OPERADOR_ADUANAS: 'Operador de aduanas', AUDITOR: 'Auditor' };
export const CAPABILITIES = [
  {"code": "INVOICE_EDIT_ISSUE_DATE", "name": "Modificar fecha de emisión", "roles": ["ADMIN"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_FORCE_RESEND", "name": "Reenvío forzado", "roles": ["ADMIN"], "reservedAdmin": false, "accessGate": "INVOICE_FORCE_RESEND_ACCESS"},
  {"code": "INVOICE_RESOLVE_DLQ", "name": "Resolver DLQ", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false, "accessGate": "INVOICE_RESOLVE_DLQ_ACCESS"},
  {"code": "INVOICE_REPROCESS_BRIDGE", "name": "Reprocesar puente", "roles": ["ADMIN"], "reservedAdmin": false, "accessGate": "INVOICE_REPROCESS_BRIDGE_ACCESS"},
  {"code": "INVOICE_EMIT", "name": "Emitir comprobantes", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_SUMMARY_SEND", "name": "Enviar resúmenes y bajas", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_SUNAT_POLL", "name": "Consultar estado SUNAT", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_RETRY_CDR", "name": "Reintentar CDR", "roles": ["ADMIN"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_NOTES_ISSUE", "name": "Emitir notas", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_DETRACTION_REGISTER", "name": "Registrar depósitos de detracción", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_BATCH_RETRY", "name": "Reenvío masivo", "roles": ["ADMIN"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_ACCOUNTING_REGULARIZE", "name": "Regularizar contabilidad", "roles": ["ADMIN"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_CONFIG_EDIT", "name": "Administrar configuración y series", "roles": ["ADMIN"], "reservedAdmin": true, "accessGate": null},
  {"code": "INVOICE_XML_REPAIR", "name": "Descargar XML con reparación", "roles": ["ADMIN", "CONTADOR", "OPERADOR_FACTURACION", "OPERADOR_ADUANAS"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_FORCE_RESEND_ACCESS", "name": "Acceso al reenvío forzado", "roles": ["ADMIN"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_REPROCESS_BRIDGE_ACCESS", "name": "Acceso al reproceso de puente", "roles": ["ADMIN"], "reservedAdmin": false, "accessGate": null},
  {"code": "INVOICE_RESOLVE_DLQ_ACCESS", "name": "Acceso a resolver DLQ", "roles": ["ADMIN", "OPERADOR_FACTURACION"], "reservedAdmin": false, "accessGate": null},
] as const;
export type CapabilityCode = typeof CAPABILITIES[number]['code'];

/** Defaults de sistema, no un techo inmutable de roles. Los permisos de acceso
 * conservan la intersección anterior @Roles + acción sin reinterpretar overrides. */
export function capabilityAllowed(role: string, code: string, override?: boolean, customEnabled = false, accessOverride?: boolean): boolean {
  const definition = CAPABILITIES.find(row => row.code === code);
  if (!definition) return false;
  const system = (SYSTEM_ROLES as readonly string[]).includes(role);
  if (!system && !customEnabled) return false;
  if (definition.reservedAdmin && role !== 'ADMIN') return false;
  const allowed = override ?? (definition.roles as readonly string[]).includes(role);
  if (!definition.accessGate) return allowed;
  const access = CAPABILITIES.find(row => row.code === definition.accessGate)!;
  return allowed && (accessOverride ?? (access.roles as readonly string[]).includes(role));
}

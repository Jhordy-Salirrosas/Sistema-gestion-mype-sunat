/** Compatibilidad en el borde de sesión; los alias no son roles nuevos. */
export const normalizeRoleCode=(code:string)=>code==='ACCOUNTANT'?'CONTADOR':code==='OPERATOR'?'OPERADOR_FACTURACION':code;

export const BRIDGE_OMITTED = 'M1_BRIDGE_INVENTORY_OMITTED';
export const BRIDGE_RESOLVED = 'M1_BRIDGE_INVENTORY_RESOLVED';
export function omisionesPendientes(history: readonly { codigo_error: string | null; mensaje_error: string | null }[] = []): string[] {
 const omitted=new Set<string>(),resolved=new Set<string>();
 for(const e of history){try{const d=JSON.parse(e.mensaje_error??'{}');if(typeof d.sku!=='string')continue;if(e.codigo_error===BRIDGE_OMITTED)omitted.add(d.sku);if(e.codigo_error===BRIDGE_RESOLVED)resolved.add(d.sku);}catch{ /* No inventar una causa desde texto legado. */ }}
 return [...omitted].filter(sku=>!resolved.has(sku));
}

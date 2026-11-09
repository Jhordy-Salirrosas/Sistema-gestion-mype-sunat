/** Presupuesto de arranque frío de Python/lxml/XSL; compartido por diagnóstico y validación. */
export function sfsTimeoutMs(): number {
  const configured = Number(process.env.SUNAT_SFS_TIMEOUT_MS);
  return Number.isSafeInteger(configured) && configured > 0 && configured <= 2_147_483_647
    ? configured : 20_000;
}

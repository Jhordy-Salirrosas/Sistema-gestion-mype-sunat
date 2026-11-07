export interface FilaPadronRetencion {
  ruc: string;
  razonSocial: string;
  validFrom: Date;
}

/** Parsea el CSV `ruc,razon_social,valid_from` del padrón de retención. */
export function parsearPadron(texto: string): FilaPadronRetencion[] {
  return texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea && !linea.startsWith('#'))
    .slice(1)
    .map((linea) => {
      const [ruc, razonSocial, fecha] = linea.split(',').map((valor) => valor.trim());
      if (!/^\d{11}$/.test(ruc ?? '')) {
        throw new Error(`RUC inválido en el padrón: ${ruc ?? '(vacío)'}`);
      }
      if (!razonSocial) throw new Error(`Falta razón social para el RUC ${ruc}`);
      const validFrom = new Date(fecha ?? '');
      if (Number.isNaN(validFrom.getTime())) {
        throw new Error(`Fecha inválida para el RUC ${ruc}: ${fecha ?? '(vacía)'}`);
      }
      return { ruc, razonSocial, validFrom };
    });
}

/**
 * Reglas de negocio de SUNAT verificables sobre el XML ya construido (M1).
 *
 * Complementan la validación estructural de `xsdValidatorService`: aquí solo
 * se comprueban condiciones que SUNAT rechaza u observa con un código de error
 * concreto (2022, importes negativos, IGV declarado).
 */

/** Resultado de aplicar las reglas de negocio. */
export interface ResultadoNegocio {
  errors: string[];
  warnings: string[];
}

/** Extrae el contenido textual del primer nodo con esa etiqueta. */
const leer = (xml: string, tag: string): string | null => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
  return match ? match[1].trim() : null;
};

/** Verifica que el emisor no figure también como adquirente (error 2022). */
const validarEmisorDistinto = (xml: string, errors: string[]): void => {
  const proveedor = xml.match(
    /<cac:AccountingSupplierParty>([\s\S]*?)<\/cac:AccountingSupplierParty>/,
  );
  const rucEmisor = proveedor
    ? proveedor[1].match(/<cbc:ID schemeID="6">\s*(\d+)\s*<\/cbc:ID>/)?.[1]
    : null;

  if (!rucEmisor) return;

  const cliente = xml.match(
    /<cac:AccountingCustomerParty>([\s\S]*?)<\/cac:AccountingCustomerParty>/,
  );

  if (cliente && cliente[1].includes(`>${rucEmisor}<`)) {
    errors.push(
      'El RUC del adquirente coincide con el del emisor (error 2022 de SUNAT)',
    );
  }
};

/** Verifica que el importe a pagar no sea negativo tras la detracción. */
const validarImportePagable = (xml: string, errors: string[]): void => {
  const pagable = leer(xml, 'cbc:PayableAmount');

  if (pagable && Number.parseFloat(pagable) < 0) {
    errors.push('El importe a pagar <cbc:PayableAmount> no puede ser negativo');
  }
};

/** Advierte sobre el IGV declarado (el régimen del emisor debe permitirlo). */
const advertirIgv = (xml: string, warnings: string[]): void => {
  const totalIgv = leer(xml, 'cbc:TaxAmount');

  if (totalIgv !== null && Number.parseFloat(totalIgv) > 0) {
    warnings.push(
      'El comprobante declara IGV: verifique que el régimen del emisor lo permita',
    );
  }
};

/** Aplica todas las reglas de negocio al XML del comprobante. */
export const validarReglasNegocio = (xml: string): ResultadoNegocio => {
  const errors: string[] = [];
  const warnings: string[] = [];

  validarEmisorDistinto(xml, errors);
  validarImportePagable(xml, errors);
  advertirIgv(xml, warnings);

  return { errors, warnings };
};

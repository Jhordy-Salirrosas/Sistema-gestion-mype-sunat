import { Injectable } from '@nestjs/common';

export interface XsdValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class XsdValidatorService {
  private readonly MANDATORY_NODES = [
    { tag: 'cbc:UBLVersionID', expectedValue: '2.1' },
    { tag: 'cbc:CustomizationID', expectedValue: '2.0' },
    { tag: 'cbc:ID', pattern: /^[F|B][A-Z0-9]{3}-\d{1,8}$/ },
    { tag: 'cbc:IssueDate', pattern: /^\d{4}-\d{2}-\d{2}$/ },
    { tag: 'cbc:InvoiceTypeCode', pattern: /^(01|03)$/ },
    { tag: 'cbc:DocumentCurrencyCode', expectedValue: 'PEN' },
    { tag: 'cac:AccountingSupplierParty' },
    { tag: 'cac:AccountingCustomerParty' },
    { tag: 'cac:TaxTotal' },
    { tag: 'cac:LegalMonetaryTotal' },
  ];

  private readonly REQUIRED_NAMESPACES = [
    { ns: 'xmlns', uri: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2' },
    { ns: 'xmlns:cac', uri: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2' },
    { ns: 'xmlns:cbc', uri: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2' },
    { ns: 'xmlns:ext', uri: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2' },
  ];

  public validateInvoiceUbl21(xmlString: string): XsdValidationResult {
    const errors: string[] = [];

    if (!xmlString || xmlString.trim().length === 0) {
      return { isValid: false, errors: ['El archivo XML está vacío'] };
    }

    if (!xmlString.includes('<Invoice') || !xmlString.includes('</Invoice>')) {
      errors.push('El elemento raíz debe ser <Invoice>');
      return { isValid: false, errors };
    }

    for (const item of this.REQUIRED_NAMESPACES) {
      const pattern = new RegExp(`${item.ns}="[^"]*"`);
      const match = xmlString.match(pattern);
      if (!match) {
        errors.push(`Namespace erróneo o ausente: falta '${item.ns}'`);
      } else if (!match[0].includes(item.uri)) {
        errors.push(`Namespace erróneo: '${item.ns}' no coincide con el oficial '${item.uri}'`);
      }
    }

    for (const rule of this.MANDATORY_NODES) {
      const openTag = `<${rule.tag}`;
      const closeTag = `</${rule.tag}>`;

      if (!xmlString.includes(openTag) || !xmlString.includes(closeTag)) {
        errors.push(`Nodo ausente obligatorio según UBL-Invoice-2.1.xsd: <${rule.tag}>`);
        continue;
      }

      const regex = new RegExp(`<${rule.tag}[^>]*>(.*?)</${rule.tag}>`, 's');
      const match = xmlString.match(regex);
      const content = match ? match[1].trim() : '';

      if (rule.expectedValue && content !== rule.expectedValue) {
        errors.push(`Tipo o valor incorrecto en <${rule.tag}>: se esperaba '${rule.expectedValue}' pero vino '${content}'`);
      }

      if (rule.pattern && !rule.pattern.test(content)) {
        errors.push(`Formato o tipo incorrecto en <${rule.tag}>: '${content}' no cumple con la regla oficial`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

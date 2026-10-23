import { Injectable } from '@nestjs/common';
import {
  NAMESPACES_OBLIGATORIOS,
  RAIZ_POR_TIPO,
  REGLAS_NODO,
  uriRaiz,
} from './xsdRules';
import { validarReglasNegocio } from './xsdBusinessRules';

export interface XsdValidationResult {
  isValid: boolean;
  errors: string[];
  /** Advertencias que no invalidan el documento (observaciones del CDR). */
  warnings: string[];
}

@Injectable()
export class XsdValidatorService {
  /** Detecta el tipo de comprobante a partir de la raíz y su código. */
  public detectarTipo(xmlString: string): string | null {
    const raiz = this.detectarRaiz(xmlString);
    if (raiz === 'CreditNote') return '07';
    if (raiz === 'DebitNote') return '08';
    if (raiz !== 'Invoice') return null;

    const match = xmlString.match(
      /<cbc:InvoiceTypeCode[^>]*>\s*(0\d)\s*<\/cbc:InvoiceTypeCode>/,
    );
    return match ? match[1] : '01';
  }

  private detectarRaiz(xmlString: string): string | null {
    const raiz = xmlString.match(/<([A-Za-z]+)[\s>]/);
    return raiz ? raiz[1] : null;
  }

  /** Devuelve el contenido textual del primer nodo con esa etiqueta. */
  private leerContenido(xmlString: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's');
    const match = xmlString.match(regex);
    return match ? match[1].trim() : null;
  }

  /** Valida namespaces y raíz del documento. */
  private validarEstructura(xmlString: string, errors: string[]): boolean {
    const raiz = this.detectarRaiz(xmlString);
    const raices = Object.values(RAIZ_POR_TIPO);

    if (!raiz || !raices.includes(raiz)) {
      errors.push(
        'El elemento raíz debe ser <Invoice>, <CreditNote> o <DebitNote>',
      );
      return false;
    }

    if (!xmlString.includes(`</${raiz}>`)) {
      errors.push(`Falta el cierre </${raiz}> del elemento raíz`);
      return false;
    }

    const nsRaiz = xmlString.match(/xmlns="([^"]+)"/);
    const esperada = uriRaiz(raiz);

    if (!nsRaiz) {
      errors.push("Falta el namespace por defecto 'xmlns' del elemento raíz");
    } else if (nsRaiz[1] !== esperada) {
      errors.push(
        `Namespace erróneo: se esperaba '${esperada}' pero vino '${nsRaiz[1]}'`,
      );
    }

    for (const item of NAMESPACES_OBLIGATORIOS) {
      const match = xmlString.match(new RegExp(`${item.ns}="[^"]*"`));
      if (!match) {
        errors.push(`Namespace erróneo o ausente: falta '${item.ns}'`);
      } else if (!match[0].includes(item.uri)) {
        errors.push(
          `Namespace erróneo: '${item.ns}' no coincide con el oficial '${item.uri}'`,
        );
      }
    }

    return true;
  }

  /** Valida los nodos obligatorios y sus valores esperados. */
  private validarNodos(xmlString: string, errors: string[]): void {
    const tipo = this.detectarTipo(xmlString);

    for (const regla of REGLAS_NODO) {
      if (regla.soloPara && (!tipo || !regla.soloPara.includes(tipo))) {
        continue;
      }

      const content = this.leerContenido(xmlString, regla.tag);

      if (!xmlString.includes(`<${regla.tag}`) || content === null) {
        errors.push(
          `Nodo ausente obligatorio según UBL-Invoice-2.1.xsd: <${regla.tag}>`,
        );
        continue;
      }

      if (regla.expectedValue && content !== regla.expectedValue) {
        errors.push(
          `Tipo o valor incorrecto en <${regla.tag}>: se esperaba '${regla.expectedValue}' pero vino '${content}'`,
        );
      }

      if (regla.pattern && !regla.pattern.test(content)) {
        errors.push(
          `Formato o tipo incorrecto en <${regla.tag}>: '${content}' no cumple con la regla oficial`,
        );
      }
    }
  }

  /** Reglas de negocio que SUNAT rechaza con un código de error concreto. */
  private validarNegocio(
    xmlString: string,
    errors: string[],
    warnings: string[],
  ): void {
    const resultado = validarReglasNegocio(xmlString);

    errors.push(...resultado.errors);
    warnings.push(...resultado.warnings);
  }

  public validateInvoiceUbl21(xmlString: string): XsdValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!xmlString || xmlString.trim().length === 0) {
      return { isValid: false, errors: ['El archivo XML está vacío'], warnings };
    }

    if (!this.validarEstructura(xmlString, errors)) {
      return { isValid: false, errors, warnings };
    }

    this.validarNodos(xmlString, errors);
    this.validarNegocio(xmlString, errors, warnings);

    return { isValid: errors.length === 0, errors, warnings };
  }
}

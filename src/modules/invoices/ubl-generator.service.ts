import { Injectable, BadRequestException } from '@nestjs/common';

export interface InvoicePayload {
  rucEmisor: string;
  razonSocialEmisor: string;
  tipoComprobante: string; // '01' Factura, '03' Boleta
  serie: string;          // F001, B001
  numero: number;         // 1, 2, ...
  fechaEmision: string;   // YYYY-MM-DD
  tipoMoneda?: string;    // PEN
  cliente?: {
    tipoDocumento: string; // '6' RUC, '1' DNI
    numeroDocumento: string;
    razonSocial: string;
  };
  montoGravado: number;
  montoIgv: number;
  montoTotal: number;
}

@Injectable()
export class UblGeneratorService {
  public generateInvoiceXml(payload: InvoicePayload): string {
    if (!payload) {
      throw new BadRequestException('El payload del comprobante es obligatorio');
    }

    const {
      rucEmisor = '',
      razonSocialEmisor = '',
      tipoComprobante = '01',
      serie = 'F001',
      numero = 1,
      fechaEmision = '',
      tipoMoneda = 'PEN',
      cliente,
      montoGravado = 0,
      montoIgv = 0,
      montoTotal = 0,
    } = payload;

    const invoiceId = `${serie}-${numero.toString().padStart(8, '0')}`;

    const customerXml = cliente
      ? `  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${cliente.tipoDocumento}">${cliente.numeroDocumento}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${cliente.razonSocial}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ccts="urn:un:unece:uncefact:documentation:2"
         xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
         xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2"
         xmlns:udt="urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${invoiceId}</cbc:ID>
  <cbc:IssueDate>${fechaEmision}</cbc:IssueDate>
  <cbc:InvoiceTypeCode listID="0101">${tipoComprobante}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${tipoMoneda}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${rucEmisor}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${razonSocialEmisor}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
${customerXml}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${tipoMoneda}">${montoIgv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${tipoMoneda}">${montoGravado.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${tipoMoneda}">${montoIgv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${tipoMoneda}">${montoGravado.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${tipoMoneda}">${montoTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${tipoMoneda}">${montoTotal.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`.trim();
  }
}
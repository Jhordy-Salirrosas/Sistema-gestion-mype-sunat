/**
 * Constructores de nodos de partes y direcciones UBL 2.1 (M1).
 *
 * Cubre los bloques `AccountingSupplierParty` y `AccountingCustomerParty`.
 * Se separan de `xmlNodesHelper` para mantener cada archivo por debajo del
 * límite de líneas del proyecto.
 */
import { esc } from './xmlNodesHelper';

export interface PartyEmisor {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  ubigeo?: string;
  direccion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  /**
   * Código de local anexo del emisor (Catálogo 59).
   *
   * Es OBLIGATORIO: SUNAT rechaza el comprobante con el código `3030` ("El XML
   * no contiene el tag o no existe información del código de local anexo del
   * emisor") si falta. Se descubrió emitiendo contra BETA el 31-10, después de
   * corregir el orden del XML.
   *
   * `0000` es el valor que SUNAT usa para el domicilio fiscal principal; el
   * resto de locales se numeran. Se declara opcional en el tipo para no romper
   * a los llamadores existentes y se rellena con `0000` por defecto.
   */
  codigoLocalAnexo?: string;
}

export interface PartyCliente {
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
}

/** Bloque `AccountingSupplierParty` con los datos del emisor. */
export const bloqueEmisor = (e: PartyEmisor): string => {
  // `AddressTypeCode` es el código de local anexo (Catálogo 59) y es
  // OBLIGATORIO: sin él SUNAT rechaza con el código 3030. Se emite también
  // cuando no hay dirección completa, porque el rechazo ocurre igual.
  const codigoAnexo = e.codigoLocalAnexo?.trim() || '0000';

  const domicilio = e.direccion
    ? `      <cac:RegistrationAddress>
        <cbc:ID>${esc(e.ubigeo ?? '150101')}</cbc:ID>
        <cbc:AddressTypeCode>${esc(codigoAnexo)}</cbc:AddressTypeCode>
        <cbc:CityName>${esc(e.provincia ?? '')}</cbc:CityName>
        <cbc:CountrySubentity>${esc(e.departamento ?? '')}</cbc:CountrySubentity>
        <cbc:District>${esc(e.distrito ?? '')}</cbc:District>
        <cac:AddressLine>
          <cbc:Line>${esc(e.direccion)}</cbc:Line>
        </cac:AddressLine>
        <cac:Country>
          <cbc:IdentificationCode>PE</cbc:IdentificationCode>
        </cac:Country>
      </cac:RegistrationAddress>`
    : `      <cac:RegistrationAddress>
        <cbc:ID>${esc(e.ubigeo ?? '150101')}</cbc:ID>
        <cbc:AddressTypeCode>${esc(codigoAnexo)}</cbc:AddressTypeCode>
        <cac:Country>
          <cbc:IdentificationCode>PE</cbc:IdentificationCode>
        </cac:Country>
      </cac:RegistrationAddress>`;

  const nombreComercial = e.nombreComercial
    ? `      <cac:PartyName>
        <cbc:Name>${esc(e.nombreComercial)}</cbc:Name>
      </cac:PartyName>`
    : '';

  return `  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${esc(e.ruc)}</cbc:ID>
      </cac:PartyIdentification>
${nombreComercial}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(e.razonSocial)}</cbc:RegistrationName>
${domicilio}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`;
};

/** Bloque `AccountingCustomerParty` con los datos del adquirente. */
export const bloqueCliente = (c: PartyCliente): string => `  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${esc(c.tipoDocumento)}">${esc(c.numeroDocumento)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(c.razonSocial)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;

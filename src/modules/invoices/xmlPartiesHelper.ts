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
}

export interface PartyCliente {
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
}

/** Bloque `AccountingSupplierParty` con los datos del emisor. */
export const bloqueEmisor = (e: PartyEmisor): string => {
  const domicilio = e.direccion
    ? `      <cac:RegistrationAddress>
        <cbc:ID>${esc(e.ubigeo ?? '150101')}</cbc:ID>
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
    : '';

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

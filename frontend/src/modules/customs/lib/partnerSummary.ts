import type { BusinessPartnerRecord } from '../services/masterDataApi';
/** Misma fuente para lista, ficha y edición; las cabeceras históricas siguen siendo fallback. */
export function resumenTercero(p: BusinessPartnerRecord) {
  const contact = p.primary_contact;
  const address = p.primary_address;
  return { email: contact ? contact.email ?? '' : p.email ?? '', phone: contact ? contact.phone ?? '' : p.phone ?? '', address: address ? address.address : p.address ?? '' };
}

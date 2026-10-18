export type SireApiBookType = 'RVIE_VENTAS' | 'RCE_COMPRAS';
export type SireDomainBookType = 'RVIE' | 'RCE';

export function toDomainBookType(
  bookType: SireApiBookType,
): SireDomainBookType {
  return bookType === 'RVIE_VENTAS' ? 'RVIE' : 'RCE';
}

export function toApiBookType(bookType: SireDomainBookType): SireApiBookType {
  return bookType === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS';
}

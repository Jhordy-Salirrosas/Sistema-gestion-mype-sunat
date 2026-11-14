export function documentoTerceroValido(tipo: string, numero: string): boolean {
  if (!numero.trim() || numero.length > 20) return false;
  if (tipo === '1') return /^\d{8}$/.test(numero);
  if (tipo !== '6') return tipo === '0' || tipo === '4';
  if (!/^\d{11}$/.test(numero)) return false;
  const suma = [5,4,3,2,7,6,5,4,3,2].reduce((s, peso, i) => s + Number(numero[i]) * peso, 0);
  const diferencia = 11 - suma % 11;
  return Number(numero[10]) === (diferencia === 10 ? 0 : diferencia === 11 ? 1 : diferencia);
}
export function errorDatosTercero(form: {docType:string;docNumber:string;legalName:string;tradeName:string;countryCode:string;email:string}, editar = false, original?: { docType: string; docNumber: string }): string | undefined {
  const identidadSinCambios = editar && original && form.docType === original.docType && form.docNumber === original.docNumber;
  if (!identidadSinCambios && !documentoTerceroValido(form.docType, form.docNumber.trim())) return 'Documento inválido: DNI de 8 dígitos o RUC de 11 dígitos con módulo 11; CE/TAX ID no vacío.';
  const nombre = form.legalName.trim();
  if (!nombre || Array.from(nombre).length < 2 || Array.from(nombre).length > 200) return 'La razón social debe contener entre 2 y 200 caracteres.';
  if (!/[\p{L}]/u.test(nombre)) return 'La razón social debe contener al menos una letra.';
  if (form.tradeName && (!form.tradeName.trim() || Array.from(form.tradeName.trim()).length > 200)) return 'El nombre comercial debe contener entre 1 y 200 caracteres.';
  if (Array.from(form.countryCode.trim()).length !== 2) return 'El país debe tener 2 caracteres.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'El email no tiene un formato válido.';
}

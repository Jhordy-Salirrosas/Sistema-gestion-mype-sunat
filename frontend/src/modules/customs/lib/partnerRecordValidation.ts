export function errorRegistroTercero(kind: 'addresses'|'contacts'|'bank-accounts', data: Record<string,string>): string | undefined {
 if(kind==='addresses'&&!data.address.trim() || kind==='contacts'&&!data.name.trim() || kind==='bank-accounts'&&(!data.bankName.trim()||!data.accountNumber.trim())) return 'Complete los campos obligatorios del registro.';
 if(kind==='contacts') {
  if(data.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))return 'El email no tiene un formato válido.';
  if(data.phone.trim()&&!/^(?:(?:\+51|0051))?9\d{8}$/.test(data.phone.replace(/[\s()-]/g,'')))return 'El teléfono debe ser un celular peruano de 9 dígitos; puede incluir +51 o 0051.';
 }
 if(kind==='bank-accounts') {
  if((data.bankCountry||'PE').toUpperCase()==='PE'&&!/^[0-9]+$/.test(data.accountNumber.trim()))return 'El número de cuenta peruana debe contener solo dígitos.';
  if(data.cci.trim()&&!/^[0-9]{20}$/.test(data.cci.trim()))return 'El CCI debe contener 20 dígitos.';
 }
}

import { BadRequestException } from '@nestjs/common';
import { isEmail } from 'class-validator';
export type PartnerRecordKind = 'addresses' | 'contacts' | 'bank-accounts';
export function telefonoPeruValido(value: string): boolean {
 return /^(?:(?:\+51|0051))?9\d{8}$/.test(value.replace(/[\s()-]/g, ''));
}
/** Solo escrituras: no normaliza ni rechaza lecturas de registros históricos. */
export function datosRegistroTercero(kind: string, dto: Record<string, unknown>, updating = false): Record<string, unknown> {
 if (!dto || typeof dto !== 'object' || Array.isArray(dto)) throw new BadRequestException('Datos del registro requeridos.');
 const fields: Record<PartnerRecordKind, Record<string, string>> = {
  addresses:{label:'label',address:'address',city:'city',state:'state',countryCode:'country_code',postalCode:'postal_code',isDefault:'is_default'},
  contacts:{name:'name',position:'position',email:'email',phone:'phone',isPrimary:'is_primary'},
  'bank-accounts':{bankName:'bank_name',bankCountry:'bank_country',accountNumber:'account_number',cci:'cci',swift:'swift',iban:'iban',beneficiary:'beneficiary',currencyCode:'currency_code',isDefault:'is_default'},
 };
 if (!Object.hasOwn(fields, kind)) throw new BadRequestException('Pestaña de tercero inválida.');
 const map=fields[kind as PartnerRecordKind];const data:Record<string,unknown>={};
 for(const [key,column] of Object.entries(map)) {
  if(dto[key] === undefined) continue;
  const value=dto[key];
  if(key==='isPrimary'||key==='isDefault') { if(typeof value!=='boolean')throw new BadRequestException('Indicador principal inválido.');data[column]=value;continue; }
  if(value!=null&&typeof value!=='string')throw new BadRequestException(`${key}: debe ser texto.`);
  data[column]=typeof value==='string'?value.trim()||null:null;
 }
 const required=kind==='addresses'?['address']:kind==='contacts'?['name']:['bank_name','account_number'];
 if(required.some(key=>!data[key]))throw new BadRequestException('Complete los campos obligatorios del registro.');
 if(data.email && !isEmail(data.email))throw new BadRequestException('El email no tiene un formato válido.');
 if(data.phone && !telefonoPeruValido(String(data.phone)))throw new BadRequestException('El teléfono debe ser un celular peruano de 9 dígitos; puede incluir +51 o 0051.');
 const country=String(data.bank_country??'PE').toUpperCase();
 if(kind==='bank-accounts' && country==='PE' && !/^[0-9]+$/.test(String(data.account_number)))throw new BadRequestException('El número de cuenta peruana debe contener solo dígitos.');
 if(data.cci && !/^[0-9]{20}$/.test(String(data.cci)))throw new BadRequestException('El CCI debe contener 20 dígitos.');
 if(Object.hasOwn(data,'label')&&!data.label)throw new BadRequestException('La etiqueta es obligatoria.');
 for(const field of ['country_code','bank_country','currency_code']) if(Object.hasOwn(data,field)&&!data[field])throw new BadRequestException('País o moneda inválidos.');
 for(const field of ['country_code','bank_country','currency_code'])if(data[field]) {
  const value=String(data[field]).toUpperCase();if(value.length!==(field==='currency_code'?3:2))throw new BadRequestException('País o moneda inválidos.');data[field]=value;
 }
 if(!updating) {
  if(kind==='addresses') { data.label??='PRINCIPAL';data.country_code??='PE';data.is_default??=false; }
  if(kind==='contacts')data.is_primary??=false;
  if(kind==='bank-accounts'){data.bank_country??='PE';data.currency_code??='PEN';data.is_default??=false;}
 }
 return data;
}

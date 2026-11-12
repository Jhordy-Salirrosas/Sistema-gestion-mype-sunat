import { BadRequestException } from '@nestjs/common';
import { isEmail, registerDecorator, type ValidationArguments } from 'class-validator';
import { IsRucValidConstraint } from '../../../invoices/application/validators/isRucValidDecorator';

export function documentoTerceroValido(tipo: unknown, numero: unknown): boolean {
  if (typeof numero !== 'string' || !numero.trim() || numero.length > 20) return false;
  if (tipo === '1') return /^\d{8}$/.test(numero);
  if (tipo === '6') return new IsRucValidConstraint().validate(numero, {} as ValidationArguments);
  return tipo === '0' || tipo === '4';
}
export function IsPartnerDocument() {
  return (object: object, propertyName: string) => registerDecorator({
    target: object.constructor, propertyName,
    options: { message: 'Documento inválido: DNI de 8 dígitos; RUC de 11 dígitos con módulo 11; CE/TAX ID no vacío.' },
    validator: { validate: (value: unknown, args: ValidationArguments) => documentoTerceroValido((args.object as { docType?: string }).docType, value) },
  });
}
export function validarDatosTercero(dto: { docType?: unknown; docNumber?: unknown; legalName?: unknown; tradeName?: unknown; countryCode?: unknown; email?: unknown }, crear: boolean): void {
  if (crear && !documentoTerceroValido(dto.docType, dto.docNumber)) throw new BadRequestException('Documento inválido para el tipo de tercero. DNI: 8 dígitos; RUC: 11 dígitos y módulo 11.');
  for (const campo of ['legalName', 'tradeName'] as const) {
    const valor = dto[campo];
    if (valor === undefined || (campo === 'tradeName' && valor === null)) {
      if (crear && campo === 'legalName') throw new BadRequestException('La razón social es obligatoria.');
      continue;
    }
    if (typeof valor !== 'string' || !valor.trim() || Array.from(valor).length > 200) throw new BadRequestException(`${campo}: debe contener entre 1 y 200 caracteres.`);
  }
  if (dto.countryCode != null && (typeof dto.countryCode !== 'string' || Array.from(dto.countryCode).length !== 2)) throw new BadRequestException('El país debe tener 2 caracteres.');
  if (dto.email != null && (typeof dto.email !== 'string' || !isEmail(dto.email))) throw new BadRequestException('El email no tiene un formato válido.');
}

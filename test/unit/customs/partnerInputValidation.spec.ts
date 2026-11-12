import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { CreatePartnerDto } from '../../../src/modules/customs/application/dto/masterDataDto';
import { MasterDataService } from '../../../src/modules/customs/application/services/masterDataService';
import { validarDatosTercero } from '../../../src/modules/customs/application/validators/partnerInputValidation';
const valido = {docType:'6',docNumber:'20100070970',legalName:'Cliente'};
describe('validación aditiva del maestro compartido', () => {
 it.each([['1','1234567'],['1','1234567A'],['6','20100070971'],['0',''],['4',''],['0','x'.repeat(21)]])('DTO y servicio rechazan %s %s', async (docType,docNumber) => {
  const dto=Object.assign(new CreatePartnerDto(),valido,{docType,docNumber});
  expect((await validate(dto)).length).toBeGreaterThan(0);
  const prisma={businessPartner:{findFirst:jest.fn(),create:jest.fn()}};
  await expect(new MasterDataService(prisma as never).createPartner('c1',dto)).rejects.toBeInstanceOf(BadRequestException);
  expect(prisma.businessPartner.findFirst).not.toHaveBeenCalled();expect(prisma.businessPartner.create).not.toHaveBeenCalled();
 });
 it.each([['1','12345678'],['6','20100070970'],['0','US-ABC'],['4','CE-123']])('preserva documento válido %s %s', async (docType,docNumber) => {
  const dto=Object.assign(new CreatePartnerDto(),valido,{docType,docNumber});
  expect(await validate(dto)).toHaveLength(0);expect(()=>validarDatosTercero(dto,true)).not.toThrow();
 });
 it.each([{legalName:' '},{legalName:'x'.repeat(201)},{tradeName:' '},{tradeName:'x'.repeat(201)},{countryCode:'PER'},{email:'invalido'}])('rechaza campos inválidos %j', patch => expect(()=>validarDatosTercero({...valido,...patch},true)).toThrow(BadRequestException));
 it('conserva campos opcionales y la actualización parcial de datos históricos', () => {
  expect(()=>validarDatosTercero({...valido,legalName:'x'.repeat(200),tradeName:'x'.repeat(200),countryCode:'PE',email:'cliente@example.com'},true)).not.toThrow();
  expect(()=>validarDatosTercero({},false)).not.toThrow();
 });
});

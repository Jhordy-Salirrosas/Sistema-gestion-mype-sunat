import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MasterDataService } from '../../../src/modules/customs/application/services/masterDataService';
import { CreatePartnerDto } from '../../../src/modules/customs/application/dto/masterDataDto';
const base = { docType: '6', docNumber: '20100070970', legalName: 'Empresa de prueba', roles: ['CLIENTE'], countryCode: 'PE' };
function setup() {
  const db = { businessPartner: { findFirst: jest.fn(async () => null), create: jest.fn(async ({ data }: any) => ({ id: 'tercero', ...data })) }, partnerContact: { create: jest.fn(async ({ data }: any) => ({ id: 'contacto', ...data })) }, partnerAddress: { create: jest.fn() } };
  return { db, service: new MasterDataService(db as never) };
}
it.each([{ email: 'persona@example.invalid' }, { phone: '+51 999 111 222' }, { email: 'persona@example.invalid', phone: '+51 999 111 222' }])('alta sin contactName crea contacto principal y conserva campos: %j', async campos => {
  const { db, service } = setup();
  const dto = plainToInstance(CreatePartnerDto, { ...base, ...campos });
  expect(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
  const result = await service.createPartner('empresa', dto);
  expect(result).toMatchObject({ email: campos.email ?? null, phone: campos.phone ?? null });
  expect(db.partnerContact.create).toHaveBeenCalledTimes(1);
  expect(db.partnerContact.create).toHaveBeenCalledWith({ data: { partner_id: 'tercero', name: base.legalName, email: campos.email ?? null, phone: campos.phone ?? null, position: 'Contacto Comercial', is_primary: true } });
});
it('conserva nombre explícito y patrón de dirección del alta', async () => {
  const { db, service } = setup();
  await service.createPartner('empresa', { ...base, address: 'Av. Prueba 123', contactName: ' Persona ', phone: ' 999111222 ' });
  expect(db.partnerContact.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: 'Persona', phone: '999111222', is_primary: true }) });
  expect(db.partnerAddress.create).toHaveBeenCalledWith({ data: expect.objectContaining({ label: 'OFICINA_CENTRAL', address: 'Av. Prueba 123' }) });
});
it('sin datos de contacto no crea un contacto ficticio', async () => {
  const { db, service } = setup(); await service.createPartner('empresa', base);
  expect(db.partnerContact.create).not.toHaveBeenCalled();
});
it('todos los campos generales enviados por el alta tienen destino persistente', async () => {
  const { db, service } = setup();
  await service.createPartner('empresa', { ...base, tradeName: 'Nombre comercial', address: 'Av. Prueba', email: 'persona@example.invalid', phone: '999111222', paymentTerms: '30_DIAS', hasCredit: true, allowsDiscount: true, currencyCode: 'USD' });
  expect(db.businessPartner.create).toHaveBeenCalledWith({ data: expect.objectContaining({ legal_name: base.legalName, trade_name: 'Nombre comercial', country_code: 'PE', address: 'Av. Prueba', email: 'persona@example.invalid', phone: '999111222', roles: ['CLIENTE'], payment_terms: '30_DIAS', has_credit: true, allows_discount: true, currency_code: 'USD' }) });
});

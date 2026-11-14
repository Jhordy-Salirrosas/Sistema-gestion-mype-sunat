import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ValidationPipe, ServiceUnavailableException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MasterDataController } from '../../../src/modules/customs/infrastructure/controllers/masterDataController';
import { MasterDataService } from '../../../src/modules/customs/application/services/masterDataService';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';

let app: INestApplication; let banks: any[]; let db: any;
beforeEach(async () => {
  banks = [];
  db = {
    businessPartner: { findFirst: jest.fn(async ({ where }: any) => where.company_id === 'empresa-a' && where.id === 'tercero' ? { id: 'tercero', addresses: [], contacts: [], bank_accounts: [...banks] } : null) },
    partnerBankAccount: { create: jest.fn(async ({ data }: any) => { const bank = { id: 'banco', ...data }; banks.push(bank); return bank; }) },
  };
  Reflect.defineMetadata('design:paramtypes', [MasterDataService], MasterDataController);
  const module = await Test.createTestingModule({ controllers: [MasterDataController], providers: [
    { provide: MasterDataService, useValue: new MasterDataService(db) },
    { provide: TOKEN_SERVICE_PORT, useValue: { verifyToken: (token: string) => token === 'vigente' ? { companyId: 'empresa-a' } : token === 'otro-tenant' ? { companyId: 'empresa-b' } : null } },
  ] }).compile();
  app = module.createNestApplication(); app.useLogger(false);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })); await app.init();
});
afterEach(async () => { await app.close(); });
const url = '/api/v1/master-data/partners/tercero';
const payload = { bankName: 'BCP', accountNumber: '123456789', currencyCode: 'USD', cci: '', swift: '' };
it('POST existente conserva BCP/USD y GET relee la cuenta con las demás subpestañas', async () => {
  const previo = await request(app.getHttpServer()).get(url).set('Authorization', 'Bearer vigente').expect(200);
  expect(previo.body).toMatchObject({ addresses: [], contacts: [], bank_accounts: [] });
  await request(app.getHttpServer()).post(url + '/bank-accounts').set('Authorization', 'Bearer vigente').send(payload).expect(201);
  const { body } = await request(app.getHttpServer()).get(url).set('Authorization', 'Bearer vigente').expect(200);
  expect(body.bank_accounts).toEqual([expect.objectContaining({ bank_name: 'BCP', currency_code: 'USD', account_number: '123456789', partner_id: 'tercero' })]);
  expect(db.businessPartner.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tercero', company_id: 'empresa-a' } }));
});
it('sesión ausente o expirada rechaza la escritura y no fabrica filas', async () => {
  await request(app.getHttpServer()).post(url + '/bank-accounts').send(payload).expect(401);
  await request(app.getHttpServer()).post(url + '/bank-accounts').set('Authorization', 'Bearer expirado').send(payload).expect(401);
  expect(db.partnerBankAccount.create).not.toHaveBeenCalled(); expect(banks).toEqual([]);
});
it('una empresa distinta no puede añadir cuentas al tercero', async () => {
  await request(app.getHttpServer()).post(url + '/bank-accounts').set('Authorization', 'Bearer otro-tenant').send(payload).expect(404);
  expect(db.partnerBankAccount.create).not.toHaveBeenCalled();
});
it('el fallo de persistencia se propaga sin afirmar un guardado exitoso', async () => {
  db.partnerBankAccount.create.mockRejectedValue(new ServiceUnavailableException('Persistencia no disponible'));
  await request(app.getHttpServer()).post(url + '/bank-accounts').set('Authorization', 'Bearer vigente').send(payload).expect(503);
  expect(banks).toEqual([]);
});

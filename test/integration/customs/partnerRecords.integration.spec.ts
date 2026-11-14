import { PrismaService } from '../../../src/database/prismaService';
import { MasterDataService } from '../../../src/modules/customs/application/services/masterDataService';
const url=process.env.TEST_DATABASE_URL;
(url?describe:describe.skip)('pestañas de terceros con PostgreSQL local',()=>{
 let db:PrismaService;let service:MasterDataService;let company:string;let partner:string;const old=process.env.DATABASE_URL;
 beforeAll(async()=>{process.env.DATABASE_URL=url;db=new PrismaService();await db.$connect();service=new MasterDataService(db);
 company=(await db.company.create({data:{ruc:`20${Date.now().toString().slice(-9)}`,legal_name:'Prueba terceros',sol_user:'MODDATOS',sol_pass_encrypted:'local'}})).id;
 partner=(await db.businessPartner.create({data:{company_id:company,doc_type:'6',doc_number:'204813697',legal_name:'Empresa Demo'}})).id;});
 afterAll(async()=>{if(company){await db.businessPartner.deleteMany({where:{company_id:company}});await db.company.delete({where:{id:company}});}await db?.$disconnect();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;});
 it.each([
  ['addresses',{address:'Av. Nueva',isDefault:true},{address:'Av. Editada'}],
  ['contacts',{name:'Contacto',email:'contacto@example.com',phone:'999111222',isPrimary:true},{name:'Contacto',email:'editado@example.com',phone:'+51 987654321'}],
  ['bank-accounts',{bankName:'BCP',accountNumber:'123456789',currencyCode:'USD'},{bankName:'BCP',accountNumber:'987654321',currencyCode:'USD'}],
 ] as const)('%s permite editar/eliminar solo registros del propio tercero',async(kind,create,update)=>{
  const row=kind==='addresses'?await service.addAddress(company,partner,create as never):kind==='contacts'?await service.addContact(company,partner,create as never):await service.addBankAccount(company,partner,create as never);
  await expect(service.changePartnerRecord('otra-empresa',partner,kind,row.id,update)).rejects.toThrow('Tercero no encontrado');
  await expect(service.changePartnerRecord(company,partner,kind,'ajeno',update)).rejects.toThrow('Registro del tercero no encontrado');
  await service.changePartnerRecord(company,partner,kind,row.id,update);
  const detail=await service.getPartner(company,partner);
  if(kind==='addresses')expect(detail.primary_address?.address).toBe('Av. Editada');
  if(kind==='contacts')expect(detail.primary_contact?.email).toBe('editado@example.com');
  await service.changePartnerRecord(company,partner,kind,row.id);
  const final=await service.getPartner(company,partner);
  if(kind==='addresses'){expect(final.primary_address).toBeNull();expect(final.address).toBeNull();}
  if(kind==='contacts'){expect(final.primary_contact).toBeNull();expect(final.email).toBeNull();expect(final.phone).toBeNull();}
  if(kind==='bank-accounts')expect(final.bank_accounts).toHaveLength(0);
 });
 it('rechaza alta con teléfono largo y edición inválida sin modificar datos históricos',async()=>{
  await expect(service.addContact(company,partner,{name:'Contacto',phone:'922222222222222'})).rejects.toThrow('9 dígitos');
  const legacy=await db.partnerContact.create({data:{partner_id:partner,name:'Histórico',phone:'922222222222222'}});
  expect((await service.getPartner(company,partner)).contacts[0].phone).toBe('922222222222222');
  await expect(service.changePartnerRecord(company,partner,'contacts',legacy.id,{name:'Histórico',phone:'922222222222222'})).rejects.toThrow('9 dígitos');
  expect((await db.partnerContact.findUniqueOrThrow({where:{id:legacy.id}})).phone).toBe('922222222222222');
  await service.changePartnerRecord(company,partner,'contacts',legacy.id);
 });
});

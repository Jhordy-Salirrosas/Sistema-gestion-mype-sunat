import { MasterDataService } from '../../../src/modules/customs/application/services/masterDataService';
it.each(['', 'Empresa'])('lista %s agrega principales sin sobrescribir cabecera',async q=>{
 const row={id:'p',email:null,phone:null,address:null};const contact={id:'c',partner_id:'p',email:'principal@example.com',phone:'999111222'};const address={id:'a',partner_id:'p',address:'Av. Principal'};
 const db={businessPartner:{findMany:jest.fn().mockResolvedValue([row])},$queryRaw:jest.fn().mockResolvedValue([row]),partnerContact:{findMany:jest.fn().mockResolvedValue([contact])},partnerAddress:{findMany:jest.fn().mockResolvedValue([address])}};
 const result=await new MasterDataService(db as never).listPartners('empresa',undefined,q);
 expect(result[0]).toMatchObject({...row,primary_contact:contact,primary_address:address});
 expect(db.partnerContact.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{partner_id:{in:['p']},partner:{company_id:'empresa'}}}));
});
it('detalle proyecta el mismo primer registro y conserva colecciones/cabecera',async()=>{
 const row={id:'p',email:'cabecera@example.com',contacts:[{id:'principal',email:'principal@example.com'}],addresses:[{id:'principal',address:'Av. Principal'}]};
 const service=new MasterDataService({businessPartner:{findFirst:jest.fn().mockResolvedValue(row)}} as never);
 expect(await service.getPartner('empresa','p')).toEqual({...row,primary_contact:row.contacts[0],primary_address:row.addresses[0]});
});
it('actualiza un tercero con identidad histórica inválida sin revalidarla ni modificarla',async()=>{
 const update=jest.fn().mockResolvedValue({id:'p',legal_name:'Empresa editada'});
 const service=new MasterDataService({businessPartner:{findFirst:jest.fn().mockResolvedValue({id:'p',doc_type:'6',doc_number:'204813697'}),update}} as never);
 await service.updatePartner('empresa','p',{legalName:'Empresa editada'});
 expect(update).toHaveBeenCalledWith({where:{id:'p'},data:{legal_name:'Empresa editada'}});
 await expect(service.createPartner('empresa',{docType:'6',docNumber:'204813697',legalName:'Empresa nueva'})).rejects.toThrow('Documento inválido');
});

import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateUserService } from '../../../src/modules/auth/application/services/createUserService';
import { CreateUserDto } from '../../../src/modules/auth/application/dto/createUserDto';
import { ROLES } from '../../../src/modules/auth/application/services/modulePermissionsService';
const dto={name:'Usuario prueba',email:'nuevo@example.invalid',password:'StrongPass123!',role:'OPERADOR_FACTURACION' as const};
function setup(){
 const prisma={user:{findFirst:jest.fn(async()=>null),create:jest.fn(async({data})=>({id:'nuevo',...data}))}};
 const hasher={hash:jest.fn(async()=> 'HASH-PRUEBA'),compare:jest.fn()};
 return {prisma,hasher,service:new CreateUserService(prisma as never,hasher)};
}
it.each(ROLES)('crea %s en la empresa del ADMIN, activa, normalizada y sin hash en respuesta',async role=>{
 const h=setup();const result=await h.service.create('empresa',{...dto,role,email:' NUEVO@EXAMPLE.INVALID ',name:' Usuario prueba '});
 expect(result).toEqual({id:'nuevo',companyId:'empresa',email:'nuevo@example.invalid',fullName:'Usuario prueba',role,isActive:true});
 expect(JSON.stringify(result)).not.toContain('HASH-PRUEBA');expect(result).not.toHaveProperty('password_hash');
 expect(h.hasher.hash).toHaveBeenCalledWith(dto.password);
 expect(h.prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({company_id:'empresa',password_hash:'HASH-PRUEBA'}),select:expect.not.objectContaining({password_hash:true})}));
});
it.each(['short','alllower123!','ALLUPPER123!','NoNumberPass!','NoSpecialPass123'])('aplica exactamente la política del registro: %s',async password=>{
 const h=setup();await expect(h.service.create('empresa',{...dto,password})).rejects.toBeInstanceOf(BadRequestException);expect(h.hasher.hash).not.toHaveBeenCalled();expect(h.prisma.user.create).not.toHaveBeenCalled();
});
it('rechaza un correo global ocupado y convierte una colisión concurrente a 409',async()=>{
 const h=setup();h.prisma.user.findFirst.mockResolvedValueOnce({id:'de-otra-empresa'} as never);
 await expect(h.service.create('empresa',dto)).rejects.toBeInstanceOf(ConflictException);expect(h.hasher.hash).not.toHaveBeenCalled();
 h.prisma.user.create.mockRejectedValueOnce({code:'P2002'});
 await expect(h.service.create('empresa',dto)).rejects.toBeInstanceOf(ConflictException);
});
it('no oculta errores de persistencia ajenos a unicidad',async()=>{const h=setup();const error=new Error('base no disponible');h.prisma.user.create.mockRejectedValueOnce(error);await expect(h.service.create('empresa',dto)).rejects.toBe(error);});
it.each([{email:'no-es-correo'},{name:'  '},{role:'OPERATOR'},{password:'123'},{name:25}])('DTO rechaza datos inválidos %j',patch=>{
 expect(validateSync(plainToInstance(CreateUserDto,{...dto,...patch})).length).toBeGreaterThan(0);
});
it('DTO normaliza correo/nombre sin recortar ni alterar la contraseña',()=>{
 const result=plainToInstance(CreateUserDto,{...dto,name:' Usuario ',email:' NUEVO@EXAMPLE.INVALID ',password:' StrongPass123! '});
 expect(result).toMatchObject({name:'Usuario',email:dto.email,password:' StrongPass123! '});
});

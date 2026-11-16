import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { SessionMembershipService } from '../../../src/modules/auth/application/services/sessionMembershipService';
const token={sub:'u',companyId:'c',email:'u@example.invalid',role:'ADMIN'};
function setup(){const db:any={user:{findFirst:jest.fn(async()=>({id:'u',company_id:'c',email:token.email,role:'OPERADOR_FACTURACION',is_active:true,company:{is_active:true}}))},companyRole:{findUnique:jest.fn(async()=>({code:'OPERADOR_FACTURACION',name:'Ventas',is_system:true}))}};return {db,service:new SessionMembershipService(db)};}
it('el guard autentica por firma y usa el rol vigente, sin privilegios del token anterior',async()=>{const{service}=setup();const guard=new AuthGuard({verifyToken:()=>token} as never,service);const req:any={headers:{authorization:'Bearer anterior'}};await expect(guard.canActivate({switchToHttp:()=>({getRequest:()=>req})} as never)).resolves.toBe(true);expect(req.user).toEqual({...token,role:'OPERADOR_FACTURACION'});});
it.each([null,{is_active:false,company:{is_active:true}},{is_active:true,company:{is_active:false}}])('usuario o empresa no vigentes denegados %j',async row=>{const{db,service}=setup();db.user.findFirst.mockResolvedValue(row);await expect(service.resolve(token)).rejects.toMatchObject({status:401});});
it('la consulta está limitada al usuario y empresa de la firma, y rechaza rol ajeno',async()=>{const{db,service}=setup();db.companyRole.findUnique.mockResolvedValue(null);await expect(service.resolve(token)).rejects.toMatchObject({status:401});expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:'u',company_id:'c'}}));});
it('rol propio no habilitado se deniega aunque exista en la empresa',async()=>{const{db,service}=setup();db.user.findFirst.mockResolvedValue({id:'u',company_id:'c',email:token.email,role:'PROPIO',is_active:true,company:{is_active:true}});db.companyRole.findUnique.mockResolvedValue({code:'PROPIO',name:'Administrador',is_system:false});await expect(service.resolve(token)).rejects.toMatchObject({status:401});});

it('refresh vuelve a firmar el rol vigente de la base, no el del registro anterior',async()=>{
 const {service}=setup();const {RefreshTokenUseCase}=await import('../../../src/modules/auth/application/use-cases/refreshTokenUseCase');
 const repo:any={findRefreshToken:jest.fn(async()=>({userId:'u',isRevoked:false,isExpired:()=>false})),findById:jest.fn(async()=>({id:'u',companyId:'c',email:token.email,role:'ADMIN',isActive:true})),revokeRefreshToken:jest.fn(),saveRefreshToken:jest.fn()};
 const tokens:any={hashToken:jest.fn(v=>v),generateRefreshToken:jest.fn(()=> 'nuevo'),signToken:jest.fn(()=> 'jwt-nuevo')};
 await new RefreshTokenUseCase(repo,tokens,service).execute('refresh-vigente');expect(tokens.signToken).toHaveBeenCalledWith(expect.objectContaining({role:'OPERADOR_FACTURACION',companyId:'c',sub:'u'}),900);
});

it.each([{sub:undefined},{companyId:undefined},{sub:''},{companyId:''}])('claims de identidad incompletos nunca producen una consulta sin filtro %j',async patch=>{const{db,service}=setup();await expect(service.resolve({...token,...patch} as never)).rejects.toMatchObject({status:401});expect(db.user.findFirst).not.toHaveBeenCalled();});

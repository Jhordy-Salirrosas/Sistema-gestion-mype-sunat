import { datosRegistroTercero, telefonoPeruValido } from '../../../src/modules/customs/application/validators/partnerRecordValidation';
it.each(['999111222','+51 999 111 222','0051-999-111-222'])('admite celular %s',phone=>expect(telefonoPeruValido(phone)).toBe(true));
it.each(['922222222222222','899111222','123','+1 999111222'])('rechaza teléfono %s',phone=>expect(()=>datosRegistroTercero('contacts',{name:'Contacto',phone})).toThrow('9 dígitos'));
it('valida correo y cuenta peruana/CCI; conserva cuentas internacionales',()=>{
 expect(()=>datosRegistroTercero('contacts',{name:'Contacto',email:'sin-formato'})).toThrow('email');
 expect(()=>datosRegistroTercero('bank-accounts',{bankName:'BCP',accountNumber:'ABC'})).toThrow('solo dígitos');
 expect(()=>datosRegistroTercero('bank-accounts',{bankName:'BCP',accountNumber:'123',cci:'123'})).toThrow('20 dígitos');
 expect(datosRegistroTercero('bank-accounts',{bankName:'Exterior',bankCountry:'US',accountNumber:'AB123',swift:'ABCDEF'})).toMatchObject({account_number:'AB123',swift:'ABCDEF'});
 expect(()=>datosRegistroTercero('addresses',{address:''})).toThrow('obligatorios');
});
it('las rutas conservan empresa, pestaña e identificador y no interpretan un PUT vacío como eliminación',()=>{
 const {MasterDataController}=require('../../../src/modules/customs/infrastructure/controllers/masterDataController');
 const changePartnerRecord=jest.fn();const controller=new MasterDataController({changePartnerRecord});
 controller.updatePartnerRecord('empresa','p','contacts','c',{name:'Contacto'});
 expect(changePartnerRecord).toHaveBeenLastCalledWith('empresa','p','contacts','c',{name:'Contacto'});
 controller.deletePartnerRecord('empresa','p','contacts','c');
 expect(changePartnerRecord).toHaveBeenLastCalledWith('empresa','p','contacts','c');
 expect(()=>controller.updatePartnerRecord('empresa','p','contacts','c',null)).toThrow('Datos del registro');
 expect(()=>controller.deletePartnerRecord(undefined,'p','contacts','c')).toThrow();
});

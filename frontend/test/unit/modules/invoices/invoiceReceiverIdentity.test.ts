import { expect, it } from 'vitest';
import { problemaIdentidadReceptor } from '@/modules/invoices/lib/invoiceReceiverIdentity';
const ruc = {doc_type:'6',doc_number:'20100070970',legal_name:'FERRETERÍA LOS ANDES S.A.C.'};
const dni = {doc_type:'1',doc_number:'12345678',legal_name:'José Pérez García'};
it('coincidencia exacta permite continuar',()=>expect(problemaIdentidadReceptor(ruc.doc_number,ruc.legal_name,[ruc])).toBeUndefined());
it.each(['ferreteria los andes s.a.c.','  FERRETERÍA   LOS  ANDES S.A.C.  ','FERRETERI\u0301A LOS ANDES S.A.C.'])('tolera mayúsculas, espacios y tildes: %s',nombre=>expect(problemaIdentidadReceptor(ruc.doc_number,nombre,[ruc])).toBeUndefined());
it('bloquea la discrepancia real con documento y nombre registrado',()=>expect(problemaIdentidadReceptor(ruc.doc_number,'SUPERMERCADOS PERUANOS',[ruc])).toBe('La razón social no coincide con la registrada para el RUC 20100070970: FERRETERÍA LOS ANDES S.A.C.'));
it('un documento no registrado no bloquea ni confunde coincidencias parciales',()=>expect(problemaIdentidadReceptor('20552103816','Cliente nuevo',[ruc])).toBeUndefined());
it('boleta con DNI registrado compara el nombre y tolera sus tildes',()=>{
 expect(problemaIdentidadReceptor(dni.doc_number,'JOSE   PEREZ GARCIA',[dni])).toBeUndefined();
 expect(problemaIdentidadReceptor(dni.doc_number,'Otro cliente',[dni])).toContain('DNI 12345678: José Pérez García');
});
it('boleta con RUC registrado usa la misma correspondencia fiscal',()=>expect(problemaIdentidadReceptor(ruc.doc_number,'Nombre ajeno',[ruc])).toContain('RUC 20100070970'));
it('el tipo de documento debe coincidir y la puntuación no se elimina',()=>{
 expect(problemaIdentidadReceptor(dni.doc_number,'Otro cliente',[{...dni,doc_type:'4'}])).toBeUndefined();
 expect(problemaIdentidadReceptor(ruc.doc_number,'FERRETERIA LOS ANDES SAC',[ruc])).toBeTruthy();
});
it('un documento vacío o incompleto se deja a las validaciones existentes',()=>{
 expect(problemaIdentidadReceptor('','Cliente',[ruc])).toBeUndefined();
 expect(problemaIdentidadReceptor('123','Cliente',[ruc])).toBeUndefined();
});

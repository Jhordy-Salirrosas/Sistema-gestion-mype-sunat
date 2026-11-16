import { describe, expect, it } from 'vitest';
import { permittedDefault } from '@/modules/invoices/hooks/useCommercialDefaults';
describe('Pago global condicionado por el maestro',()=>{
  it('no otorga crédito a un cliente no habilitado',()=>expect(permittedDefault({forma_pago:'Credito',medio_pago:'YAPE'},false,'01')).toBe('Contado'));
  it('un cliente con crédito conserva Contado cuando es la configuración global',()=>expect(permittedDefault({forma_pago:'Contado',medio_pago:'EFECTIVO'},true,'01')).toBe('Contado'));
  it('usa crédito global solo en factura habilitada',()=>{ expect(permittedDefault({forma_pago:'Credito',medio_pago:'YAPE'},true,'01')).toBe('Credito');expect(permittedDefault({forma_pago:'Credito',medio_pago:'YAPE'},true,'03')).toBe('Contado'); });
});

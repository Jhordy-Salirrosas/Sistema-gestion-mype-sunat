import { agregarFilaModal } from '@/modules/invoices/lib/invoiceEmptyRow';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';
import { useAuthStore } from '@/stores/authStore';
import { cleanup } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async()=>({data:[]}))}}));
beforeEach(()=>{useAuthStore.setState({user:{id:'test',email:'test@example.invalid',role:'ADMIN'}});});
afterEach(()=>cleanup());
it('primera vacía se reutiliza sin crear claves ni perder datos',()=>{
 const items=[{...itemVacio('a'),codigo:'  ',descripcion:' ',cantidad:2},itemVacio('b')];const create=vi.fn(()=>itemVacio('c'));
 expect(agregarFilaModal(items,create)).toBe(items);expect(create).not.toHaveBeenCalled();
});
it.each([{codigo:'SKU',descripcion:''},{codigo:'',descripcion:'Producto'},null])('añade cuando la primera está ocupada o no existe: %j',line=>{
 const items=line?[{...itemVacio('a'),...line}]:[];const create=vi.fn(()=>itemVacio('nueva'));
 expect(agregarFilaModal(items,create)).toEqual([...items,itemVacio('nueva')]);expect(create).toHaveBeenCalledTimes(1);
});

import { validarCantidadesNota } from '../../../src/modules/invoices/application/services/creationGuards';
const origen = [{ item_code: 'CEM', quantity: 2 }];
it('7D no permite cien unidades por el precio reducido de una', () => {
 expect(() => validarCantidadesNota([{ codigo: 'CEM', cantidad: 100 }], origen, [])).toThrow('NOTA_EXCEDE_CANTIDAD');
});
it('7D suma devoluciones pendientes y líneas repetidas contra el origen', () => {
 expect(() => validarCantidadesNota([{ codigo: 'CEM', cantidad: .5 }, { codigo: 'CEM', cantidad: .6 }], origen, [{ item_code: 'CEM', quantity: 1 }])).toThrow('NOTA_EXCEDE_CANTIDAD');
 expect(() => validarCantidadesNota([{ codigo: 'CEM', cantidad: 1 }], origen, [{ item_code: 'CEM', quantity: 1 }])).not.toThrow();
});
it('7D rechaza producto ajeno aunque exista activo en el catálogo', () => {
 expect(() => validarCantidadesNota([{ codigo: 'OTRO', cantidad: 1 }], origen, [])).toThrow('ajeno');
});

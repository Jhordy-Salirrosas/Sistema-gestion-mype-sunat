import { InvoiceSunatConsultController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceSunatConsultController';
const invoice = { id: 'i', ruc_emisor: '20601234567', tipo_comprobante: '01', serie: 'F001', correlativo: 60 };
it.each([{ tipo: 'NO_ENCONTRADO' }, { tipo: 'INCIERTO', motivo: 'timeout' },
  { tipo: 'RECUPERADO', resultado: { estado: 'ACEPTADO', responseCode: '0', cdr: { referenceId: 'F001-60' } } },
  { tipo: 'RECUPERADO', resultado: { estado: 'ACEPTADO', responseCode: '0', cdr: null } }])(
  'consulta solo el documento de la empresa, sin emitir: %j', async (result) => {
    const findFirst = jest.fn(async () => invoice), consultar = jest.fn(async () => result);
    const controller = new InvoiceSunatConsultController({ invoice: { findFirst } } as never, { consultar } as never);
    const actual = await controller.consultar('empresa', 'i');
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'i', company_id: 'empresa' } }));
    expect(consultar).toHaveBeenCalledWith({ companyId: 'empresa', invoiceId: 'i', rucEmisor: '20601234567', tipoComprobante: '01', serie: 'F001', correlativo: 60 });
    expect(actual).toMatchObject({ tipo: result.tipo });
  },
);
it('un documento de otra empresa no llega a SUNAT', async () => {
  const consultar = jest.fn();
  const controller = new InvoiceSunatConsultController({ invoice: { findFirst: async () => null } } as never, { consultar } as never);
  await expect(controller.consultar('otra', 'i')).rejects.toThrow('no encontrado');
  expect(consultar).not.toHaveBeenCalled();
});

it('expone el mensaje real del CDR recuperado para el detalle, sin invocar transporte de envío', async () => {
  const consultar = jest.fn(async () => ({ tipo: 'RECUPERADO', resultado: { estado: 'ACEPTADO', responseCode: '0', cdr: { referenceId: 'F001-60', description: 'Factura aceptada por SUNAT' } } }));
  const controller = new InvoiceSunatConsultController({ invoice: { findFirst: async () => invoice } } as never, { consultar } as never);
  expect(await controller.consultar('empresa', 'i')).toEqual({ tipo: 'RECUPERADO', estado: 'ACEPTADO', codigo: '0', mensaje: 'Factura aceptada por SUNAT', referencia: 'F001-60' });
  expect(consultar).toHaveBeenCalledTimes(1);
});

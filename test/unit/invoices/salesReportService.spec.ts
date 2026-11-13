import { BadRequestException } from '@nestjs/common';
import { SalesReportService } from '../../../src/modules/invoices/application/services/salesReportService';

describe('SalesReportService', () => {
  it('calcula ventas, costo y margen', async () => {
    const prisma = {
      invoice: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', tipo_comprobante: '01', serie: 'F001', correlativo: 1, fecha_emision: new Date('2026-11-10'), customer_identity_number: '20100070970', customer_legal_name: 'Cliente', monto_total: 1180, taxable_operations: 1000, total_igv: 180 }]) },
      accountingEntry: { findMany: jest.fn().mockResolvedValue([{ source_reference_id: 'i1:COSTO', lines: [{ account_code: '69111', debit_amount: 600, credit_amount: 0 }] }]) },
    };
    const r = await new SalesReportService(prisma as never).execute('c1', '2026-11-01', '2026-11-30');
    expect(r.totals).toMatchObject({ sales: 1180, cost: 600, profit: 400, margin: 40, documents: 1 });
    expect(r.byCustomer[0]).toMatchObject({ customer: 'Cliente', profit: 400 });
  });

  it('rechaza rango inválido', async () => {
    const prisma = { invoice: { findMany: jest.fn() }, accountingEntry: { findMany: jest.fn() } };
    await expect(new SalesReportService(prisma as never).execute('c1', '2026-12-01', '2026-11-01')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marca ventas sin costo y excluye su margen', async () => {
    const prisma = {
      invoice: { findMany: jest.fn().mockResolvedValue([
        { id: 'i1', tipo_comprobante: '01', serie: 'F001', correlativo: 1, fecha_emision: new Date('2026-11-10'), customer_identity_number: '1', customer_legal_name: 'Con costo', monto_total: 1180, taxable_operations: 1000, total_igv: 180 },
        { id: 'i2', tipo_comprobante: '01', serie: 'F001', correlativo: 2, fecha_emision: new Date('2026-11-11'), customer_identity_number: '2', customer_legal_name: 'Sin costo', monto_total: 500, taxable_operations: 423.73, total_igv: 76.27 },
      ]) },
      accountingEntry: { findMany: jest.fn().mockResolvedValue([{ source_reference_id: 'i1:COSTO', lines: [{ account_code: '69111', debit_amount: 600, credit_amount: 0 }] }]) },
    };
    const r = await new SalesReportService(prisma as never).execute('c1', '2026-11-01', '2026-11-30');
    expect(r.totals.withoutCost).toEqual({ count: 1, sales: 500 });
    expect(r.totals.margin).toBe(40);
    expect(r.byDocument.find((d) => d.id === 'i2')?.hasCost).toBe(false);
  });
});

  it('firma 07, conserva 08 y expone utilidad nula sin costo en documentos y grupos', async () => {
    const row = (id: string, tipo: string, customer: string, day: string, base: number) => ({ id, tipo_comprobante: tipo, serie: tipo === '03' ? 'B001' : 'F001', correlativo: 1, fecha_emision: new Date(day), customer_identity_number: customer, customer_legal_name: customer, monto_total: base * 1.18, taxable_operations: base, total_igv: base * .18 });
    const invoice = { findMany: jest.fn().mockResolvedValue([row('a','01','A','2026-11-01',100),row('b','07','A','2026-11-01',20),row('c','08','B','2026-11-02',10),row('d','03','B','2026-11-02',50),row('e','01','A','2026-11-01',10)]) };
    const accountingEntry = { findMany: jest.fn().mockResolvedValue([{source_reference_id:'a:COSTO',lines:[{account_code:'69',debit_amount:60,credit_amount:0}]},{source_reference_id:'e:COSTO',lines:[{account_code:'69',debit_amount:0,credit_amount:0}]}]) };
    const r = await new SalesReportService({invoice,accountingEntry} as never).execute('c','2026-11-01','2026-11-12');
    expect(r.totals).toMatchObject({sales:177,taxable:150,igv:27,cost:60,profit:50,margin:45.45,documents:5,withoutCost:{count:1,sales:59}});
    expect(r.byDocument.find(x=>x.id==='b')).toMatchObject({total:-23.6,profit:null});
    expect(r.byDocument.find(x=>x.id==='e')).toMatchObject({profit:10,hasCost:true});
    expect(r.byCustomer.find(x=>x.document==='A')).toMatchObject({sales:106.2,profit:50});
    expect(r.byCustomer.find(x=>x.document==='B')).toMatchObject({sales:70.8,profit:null});
    expect(r.daily).toEqual([{date:'2026-11-01',sales:106.2,taxable:90,igv:16.2,cost:60,profit:50},{date:'2026-11-02',sales:70.8,taxable:60,igv:10.8,cost:0,profit:null}]);
  });

it('sin costo ni identidad del cliente informa utilidad nula y margen total cero',async()=>{
 const invoice={findMany:jest.fn(async()=>[{id:'n',tipo_comprobante:'03',serie:'B001',correlativo:1,fecha_emision:new Date('2026-11-12'),customer_identity_number:null,customer_legal_name:null,monto_total:118,taxable_operations:100,total_igv:18}])};
 const r=await new SalesReportService({invoice,accountingEntry:{findMany:async()=>[]}} as never).execute('c');
 expect(r.totals).toMatchObject({profit:0,margin:0,withoutCost:{count:1,sales:118}});
 expect(r.byCustomer[0]).toMatchObject({document:'',customer:'',profit:null});expect(r.byDocument[0]).toMatchObject({customer:'',profit:null});
});

it.each(['2026-12-01T00:00:00Z', '2026-12-01T04:59:00Z', '2026-12-01T05:00:00Z'])('período predeterminado usa el mes de Lima en %s', async instant => {
  jest.useFakeTimers().setSystemTime(new Date(instant));
  try {
    const invoice = { findMany: jest.fn(async () => []) };
    const service = new SalesReportService({ invoice, accountingEntry: { findMany: jest.fn(async () => []) } } as never);
    const report = await service.execute('c');
    expect(report.from).toBe(instant.endsWith('05:00:00Z') ? '2026-12-01' : '2026-11-01');
    expect(report.to).toBe(instant.endsWith('05:00:00Z') ? '2026-12-31' : '2026-11-30');
    const explicit = await service.execute('c', '2026-10-01', '2026-10-31');
    expect(explicit).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
  } finally { jest.useRealTimers(); }
});

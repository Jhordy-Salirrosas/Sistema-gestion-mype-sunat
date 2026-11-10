import { claimIndividualSummaryChannel } from '../../../src/modules/invoices/application/services/summaryIndividualClaim';
function harness() {
  const db={invoiceAggregate:{findMany:jest.fn(async()=>[] as {members:{id:string}[]}[])},invoice:{findUnique:jest.fn(async()=>({company_id:'company',tipo_comprobante:'03',serie:'B001'}) as unknown),findUniqueOrThrow:jest.fn(async()=>({estado:'PENDIENTE'})),update:jest.fn(async()=>({}))},$executeRaw:jest.fn(async()=>1),$transaction:jest.fn()}; db.$transaction.mockImplementation(async fn=>fn(db)); return db;
}
it('doble antiguo sin delegado no abre transacción',async()=>{expect(await claimIndividualSummaryChannel({} as never,'i')).toBe(true);});
it.each([null,{tipo_comprobante:'01',serie:'F001'},{tipo_comprobante:'07',serie:'FC01'}])('otros documentos no compiten con RC: %j',async invoice=>{
  const db=harness(); db.invoice.findUnique.mockResolvedValue(invoice); expect(await claimIndividualSummaryChannel(db as never,'i')).toBe(true); expect(db.$transaction).not.toHaveBeenCalled();
});
it.each(['ACEPTADO','OBSERVADO','RECHAZADO','ANULADO'])('final %s permite solo camino final existente',async estado=>{
  const db=harness(); db.invoice.findUniqueOrThrow.mockResolvedValue({estado}); expect(await claimIndividualSummaryChannel(db as never,'i')).toBe(true); expect(db.invoice.update).not.toHaveBeenCalled(); expect(db.invoiceAggregate.findMany).not.toHaveBeenCalled();
});
it('reserva RC bloquea el job individual bajo bloqueo de empresa',async()=>{
  const db=harness(); db.invoiceAggregate.findMany.mockResolvedValue([{members:[{id:'other'},{id:'i'}]}]); expect(await claimIndividualSummaryChannel(db as never,'i')).toBe(false); expect(db.invoice.update).not.toHaveBeenCalled(); expect(db.$executeRaw).toHaveBeenCalled(); expect(db.invoiceAggregate.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{company_id:'company',kind:'RC',state:{notIn:['BLOCKED','REJECTED']}}}));
});
it.each(['PENDIENTE','ERROR_RED','ENVIADO'])('individual reclama %s conservando incertidumbre histórica',async estado=>{
  const db=harness(); db.invoice.findUniqueOrThrow.mockResolvedValue({estado}); db.invoiceAggregate.findMany.mockResolvedValue([{members:[{id:'other'}]}]); expect(await claimIndividualSummaryChannel(db as never,'i')).toBe(true);
  if(estado==='PENDIENTE')expect(db.invoice.update).toHaveBeenCalledWith({where:{id:'i'},data:{estado:'PROCESANDO'}}); else expect(db.invoice.update).not.toHaveBeenCalled();
});

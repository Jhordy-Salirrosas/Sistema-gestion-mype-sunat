import { InvoiceSummaryService } from '../../../src/modules/invoices/application/services/invoiceSummaryService';
const date='2026-11-09';
function invoice(id='invoice',estado='ACEPTADO',type='01') {return {id,company_id:'company',ruc_emisor:'20000000001',serie:type==='03'?'B001':'F001',correlativo:1,tipo_comprobante:type,estado,fecha_emision:new Date(`${date}T12:00:00Z`),monto_total:118,total_igv:18,transport_uncertain:false as boolean|null,customer_identity_type:'6',customer_identity_number:'20100070970',referenced_series_correlative:null as string|null,payload_ubl:{lineas:[{id:1,descripcion:'Ficticio',cantidad:1,valorUnitario:100,totalLinea:118,igvLinea:18,afectacion:'10'}]}};}
function harness() {
  const rows=[invoice()];const db={invoice:{findMany:jest.fn().mockResolvedValueOnce(rows).mockResolvedValue([])},company:{findUnique:jest.fn(async()=>({ruc:'20000000001',legal_name:'Ficticio'}))},invoiceAggregate:{findMany:jest.fn(async()=>[] as {members:{id:string}[]}[])}};
  return {rows,db,view:new InvoiceSummaryService(db as never)};
}
beforeEach(()=>{jest.useFakeTimers();jest.setSystemTime(new Date(`${date}T12:00:00Z`));});afterEach(()=>jest.useRealTimers());
it('RA selección explícita transporta motivo y excluye los no elegidos',async()=>{
  const h=harness();h.rows.push({...invoice('other'),correlativo:2});const v=await h.view.vistaComunicacionBaja('company',date,3,[{id:'invoice',motivo:'Error comercial'}]);
  expect(v.envio.lineas).toBe(1);expect(v.xml).toContain('<sac:VoidReasonDescription>Error comercial</sac:VoidReasonDescription>');expect(v.lineas[1]).toMatchObject({incluido:false,motivoExclusion:'No seleccionado.'});
});
it.each(['RUC','vencido','futuro','NC completa','NC pendiente','reserva','ANULADO'])('RA excluye %s con causa',async reason=>{
  const h=harness();
  if(reason==='RUC')h.rows[0].ruc_emisor='20000000002';
  if(reason==='vencido')h.rows[0].fecha_emision=new Date('2026-10-01T12:00:00Z');
  if(reason==='futuro')h.rows[0].fecha_emision=new Date('2026-11-10T12:00:00Z');
  if(reason==='NC completa'||reason==='NC pendiente')h.db.invoice.findMany.mockResolvedValue([{referenced_invoice_id:'invoice',estado:reason==='NC completa'?'ACEPTADO':'EN_COLA',monto_total:118}]);
  if(reason==='reserva')h.db.invoiceAggregate.findMany.mockResolvedValue([{members:[{id:'invoice'}]}]);
  if(reason==='ANULADO')h.rows[0].estado='ANULADO';
  const v=await h.view.vistaComunicacionBaja('company',date);expect(v.lineas[0].incluido).toBe(false);expect(v.lineas[0].motivoExclusion).not.toBe('');expect(v.xml).toBeNull();
});
it('7I RA excluye NC parcial aceptada también sobre origen OBSERVADO',async()=>{
  const h=harness();h.rows[0].estado='OBSERVADO';h.db.invoice.findMany.mockResolvedValue([{referenced_invoice_id:'invoice',estado:'ACEPTADO',monto_total:10},{referenced_invoice_id:null,estado:'ACEPTADO',monto_total:118}]);
  expect((await h.view.vistaComunicacionBaja('company',date)).envio.lineas).toBe(0);
});
it('selección RA ajena no genera XML y la transacción excluye su propia reserva',async()=>{
  const h=harness();const v=await h.view.vistaComunicacionBaja('company',date,1,[{id:'missing',motivo:'Prueba'}],h.db as never,'own');expect(v.xml).toBeNull();expect(v.envio.lineas).toBe(0);expect(v.lineas[0].motivoExclusion).toBe('No seleccionado.');expect(h.db.invoiceAggregate.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:{not:'own'}})}));
});
it.each(['EN_COLA','PROCESANDO','ENVIADO','ERROR_RED','incierto','desconocido','reserva','RUC','vencido','futuro','sin fiscal','total distinto'])('RC excluye %s sin ofrecer reenvío individual',async reason=>{
  const h=harness();h.rows.splice(0,1,invoice('invoice','PENDIENTE','03'));
  if(['EN_COLA','PROCESANDO','ENVIADO','ERROR_RED'].includes(reason))h.rows[0].estado=reason;
  if(reason==='incierto')h.rows[0].transport_uncertain=true;
  if(reason==='desconocido')h.rows[0].transport_uncertain=null;
  if(reason==='reserva')h.db.invoiceAggregate.findMany.mockResolvedValue([{members:[{id:'invoice'}]}]);
  if(reason==='RUC')h.rows[0].ruc_emisor='20000000002';
  if(reason==='vencido')h.rows[0].fecha_emision=new Date('2026-10-01T12:00:00Z');
  if(reason==='futuro')h.rows[0].fecha_emision=new Date('2026-11-10T12:00:00Z');
  if(reason==='sin fiscal')h.rows[0].payload_ubl={lineas:[]};
  if(reason==='total distinto')h.rows[0].monto_total=119;
  const v=await h.view.vistaResumenDiario('company',date);expect(v.lineas[0]).toMatchObject({incluido:false,reenviable:false,motivoExclusion:expect.any(String)});expect(v.xml).toBeNull();expect(v.envio.lineas).toBe(0);
});
it('RC selecciona dentro de transacción, genera Catálogo 11 y referencia de nota',async()=>{
  const h=harness();const note={...invoice('note','PENDIENTE','03'),tipo_comprobante:'07',serie:'BC01',referenced_series_correlative:'B001-1'};h.rows.splice(0,1,invoice('invoice','PENDIENTE','03'),note);
  const v=await h.view.vistaResumenDiario('company',date,2,[{id:'note',motivo:''}],h.db as never,'own');
  expect(v.envio.lineas).toBe(1);expect(v.xml).toContain('<cbc:PaidAmount currencyID="PEN">100.00</cbc:PaidAmount>');expect(v.xml).toContain('<cbc:ID>B001-1</cbc:ID>');expect(v.lineas[0].motivoExclusion).toBe('No seleccionado en la reserva.');
});
it('RC detecta pérdida de elegibilidad y referencia faltante sin construir un envío parcial',async()=>{
  const h=harness();h.rows.splice(0,1,{...invoice('invoice','PENDIENTE','03'),tipo_comprobante:'07',serie:'BC01'});
  const v=await h.view.vistaResumenDiario('company',date,1,[{id:'invoice',motivo:''},{id:'missing',motivo:''}]);expect(v.errores).toEqual(expect.arrayContaining([expect.stringContaining('ya no son elegibles'),expect.stringContaining('referencia real')]));expect(v.xml).toBeNull();
});
it.each(['ACEPTADO','OBSERVADO'])('7I razón visible y selección obsoleta no habilitan RA con nota %s', async estado => {
 const h = harness(); h.db.invoice.findMany.mockResolvedValue([{ referenced_invoice_id: 'invoice', estado, monto_total: 1 }]);
 const v = await h.view.vistaComunicacionBaja('company', date, 1, [{ id: 'invoice', motivo: 'Baja' }]);
 expect(v.lineas[0]).toMatchObject({ incluido: false, motivoExclusion: 'Tiene notas asociadas.' });
 expect(v.xml).toBeNull();
});

it.each(['RA', 'RC'])('cabecera %s usa el pin y excluye históricos de otro RUC', async kind => {
  const h = harness();
  h.db.company.findUnique.mockResolvedValue({ ruc: '20614142503', issuer_ruc: '20601234567', legal_name: 'Emisor M1' } as never);
  h.rows.splice(0, 1, { ...invoice('invoice', kind === 'RC' ? 'PENDIENTE' : 'ACEPTADO', kind === 'RC' ? '03' : '01'), ruc_emisor: '20601234567' },
    { ...invoice('historico', kind === 'RC' ? 'PENDIENTE' : 'ACEPTADO', kind === 'RC' ? '03' : '01'), ruc_emisor: '20614142503', correlativo: 2 });
  const vista = kind === 'RC' ? await h.view.vistaResumenDiario('company', date) : await h.view.vistaComunicacionBaja('company', date);
  expect(vista.xml).toContain('<cbc:CustomerAssignedAccountID>20601234567</cbc:CustomerAssignedAccountID>');
  expect(vista.lineas.find(l => l.id === 'invoice')?.incluido).toBe(true);
  expect(vista.lineas.find(l => l.id === 'historico')).toMatchObject({ incluido: false, motivoExclusion: 'RUC histórico distinto al emisor efectivo.' });
});

import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { SummaryJobConsumer, type SummaryPollingJob } from '../../../src/modules/invoices/summaryJobConsumer';
import { resolveSummaryTimeout, SunatSummaryClient } from '../../../src/modules/sunat/soap/sunatSummaryOperations';
import { resolveTimeout } from '../../../src/modules/sunat/soap/sunatBillTypes';
import { summaryDispatchHarness } from '../../fixtures/summaryDispatchHarness';

const oldSummary = process.env.SUNAT_SUMMARY_TIMEOUT_MS;
const oldIndividual = process.env.SUNAT_TIMEOUT_MS;
afterEach(() => {
  if (oldSummary === undefined) delete process.env.SUNAT_SUMMARY_TIMEOUT_MS; else process.env.SUNAT_SUMMARY_TIMEOUT_MS = oldSummary;
  if (oldIndividual === undefined) delete process.env.SUNAT_TIMEOUT_MS; else process.env.SUNAT_TIMEOUT_MS = oldIndividual;
  jest.restoreAllMocks(); jest.useRealTimers();
});
it.each([undefined, '', '0', '-1', 'NaN', 'Infinity', '1.5', '2147483648'])('timeout de agregados inválido/ausente %s usa 90000', value => {
  if (value === undefined) delete process.env.SUNAT_SUMMARY_TIMEOUT_MS; else process.env.SUNAT_SUMMARY_TIMEOUT_MS = value;
  expect(resolveSummaryTimeout()).toBe(90000);
});
it('override de agregados no modifica el presupuesto individual', () => {
  process.env.SUNAT_TIMEOUT_MS = '3210'; process.env.SUNAT_SUMMARY_TIMEOUT_MS = '7654';
  expect(resolveSummaryTimeout()).toBe(7654); expect(resolveTimeout()).toBe(3210);
});
it.each(['90000','120000'])('sendSummary y getStatus usan presupuesto %s sin contexto', async budget => {
  process.env.SUNAT_SUMMARY_TIMEOUT_MS = budget;
  jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response('<ticket>T</ticket>')).mockResolvedValueOnce(new Response('<statusCode>98</statusCode>'));
  const timeout = jest.spyOn(AbortSignal,'timeout');
  const client = new SunatSummaryClient('http://127.0.0.1/mock');
  await client.sendSummary({fileName:'20000000001-RA-20261109-001.zip',zip:Buffer.from('fake')}); await client.getStatus('T');
  expect(timeout.mock.calls).toEqual([[Number(budget)],[Number(budget)]]);
});
it('contexto M1 específico llega a ambas operaciones sin mutar el contexto general', async () => {
  const h=summaryDispatchHarness(); h.context.timeoutMs=30000; process.env.SUNAT_SUMMARY_TIMEOUT_MS='7654';
  expect((await h.service.procesar(h.job,{maxConsultas:0})).enviado).toBe(true);
  expect(h.client.sendSummary).toHaveBeenCalledWith(expect.objectContaining({context:expect.objectContaining({timeoutMs:7654})}));
  expect(h.client.getStatus).toHaveBeenCalledWith('T-FAKE',expect.anything(),expect.objectContaining({timeoutMs:7654})); expect(h.context.timeoutMs).toBe(30000);
});
it.each(['TimeoutError','AbortError'])('mensaje de %s muestra presupuesto efectivo del contexto', async name => {
  jest.spyOn(globalThis,'fetch').mockRejectedValue(Object.assign(new Error('simulado'),{name}));
  await expect(new SunatSummaryClient('http://127.0.0.1/mock',500).getStatus('T',null,{endpoint:'http://127.0.0.1/mock',timeoutMs:7654} as never)).rejects.toThrow('Timeout de 7654 ms esperando al billService');
});
it.each(['timeout','98','99'])('%s → sondeos diferidos hasta 24, mismo ticket, sin segundo sendSummary', async outcome => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-11-10T00:00:00Z'));
  const h=summaryDispatchHarness();
  h.store.ticket.mockImplementation(async (_id,ticket) => {h.row.ticket=ticket;h.row.state='POLLING';});
  h.store.pendiente.mockImplementation(async (_id,error) => {h.row.error=error;});
  if(outcome==='timeout')h.client.getStatus.mockRejectedValue(new Error('Timeout de 90000 ms esperando al billService'));
  else h.client.getStatus.mockResolvedValue({statusCode:outcome,enProceso:true,contenido:null});
  let job:SummaryPollingJob=h.job;
  for(let attempt=1;attempt<=24;attempt++){
    // Una instancia nueva por corrida prueba que el contador viene del payload.
    const consumer=new SummaryJobConsumer(h.queue as never,h.service,h.store as never);
    const result=await consumer.procesar(job);
    expect(h.client.getStatus).toHaveBeenCalledTimes(attempt);
    expect(h.client.sendSummary).toHaveBeenCalledTimes(1);
    expect(result?.ticket).toBe('T-FAKE');
    if(attempt<24){
      const [next,startAfter]=(h.queue.encolarResumen.mock.calls as unknown as [SummaryPollingJob,Date][])[attempt-1];
      const minutes=attempt===1?5:attempt===2?15:attempt===3?30:60;
      expect(startAfter.getTime()-Date.now()).toBe(minutes*60_000);
      expect(next).toMatchObject({sondeoIntento:attempt+1,ticketConsulta:'T-FAKE'});
      job=JSON.parse(JSON.stringify(next));jest.setSystemTime(startAfter);
    }else{
      expect(result?.error).toContain('agotado tras 24 intentos');
      expect(h.queue.encolarResumen).toHaveBeenCalledTimes(23);
      expect(h.row.state).toBe('POLLING');expect(h.row.error).toContain('consulte el ticket manualmente');
    }
  }
  h.client.getStatus.mockResolvedValue({statusCode:'0',enProceso:false,contenido:'cdr'});
  expect((await h.service.procesar(h.job,{maxConsultas:0})).enviado).toBe(true);
  expect(h.client.sendSummary).toHaveBeenCalledTimes(1);
});
it('job diferido nunca reenvía si falta el ticket guardado o no coincide', async () => {
  const h=summaryDispatchHarness();h.row.ticket=null;
  const result=await new SummaryJobConsumer(h.queue as never,h.service,h.store as never).procesar({...h.job,sondeoIntento:2,ticketConsulta:'T'}).catch(error=>({error:error.message}));
  expect(result?.error).toContain('TICKET_MISMATCH');expect(h.client.sendSummary).not.toHaveBeenCalled();expect(h.client.getStatus).not.toHaveBeenCalled();
});
it('caída de cola relanza sin perder ticket; la reentrega solo consulta', async () => {
  const h=summaryDispatchHarness();h.row.ticket='stored';h.client.getStatus.mockResolvedValue({statusCode:'98',enProceso:true,contenido:null});h.queue.encolarResumen.mockResolvedValueOnce(null as never);
  const consumer=new SummaryJobConsumer(h.queue as never,h.service,h.store as never);
  await expect(consumer.procesar(h.job)).rejects.toThrow('SUMMARY_POLL_ENQUEUE_FAILED');await consumer.procesar(h.job);
  expect(h.client.sendSummary).not.toHaveBeenCalled();expect(h.client.getStatus).toHaveBeenCalledTimes(2);
});
it.each([0,25,1.5])('contador inválido %s no toca transporte', async sondeoIntento => {
  const h=summaryDispatchHarness();await expect(new SummaryJobConsumer(h.queue as never,h.service,h.store as never).procesar({...h.job,sondeoIntento})).rejects.toThrow('ATTEMPT_INVALID');expect(h.client.sendSummary).not.toHaveBeenCalled();
});
it('contador diferido sin ticket no toca transporte', async () => {
  const h=summaryDispatchHarness();await expect(new SummaryJobConsumer(h.queue as never,h.service,h.store as never).procesar({...h.job,sondeoIntento:2})).rejects.toThrow('TICKET_REQUIRED');expect(h.client.getStatus).not.toHaveBeenCalled();
});
it('encolarResumen conserva llamada original y transmite startAfter solo cuando se proporciona', async () => {
  const send=jest.fn(async()=> 'job');const queue=Object.assign(Object.create(QueueService.prototype),{boss:{send},logger:{error:jest.fn()}}) as QueueService;
  const h=summaryDispatchHarness();expect(await queue.encolarResumen(h.job)).toBe('job');expect(send).toHaveBeenLastCalledWith('sunat-summary-queue',h.job);
  const date=new Date('2026-11-10T00:05:00Z');await queue.encolarResumen(h.job,date);expect(send).toHaveBeenLastCalledWith('sunat-summary-queue',h.job,{startAfter:date});
  send.mockRejectedValue(new Error('cola no disponible'));expect(await queue.encolarResumen(h.job,date)).toBeNull();
});
it('CDR finalizado detiene una reentrega diferida sin más SOAP ni publicaciones', async () => {
  const h=summaryDispatchHarness();h.row.ticket='stored';h.row.state='ACCEPTED';h.row.result={codigo:'0',contenido:'saved-cdr'};
  expect((await new SummaryJobConsumer(h.queue as never,h.service,h.store as never).procesar({...h.job,sondeoIntento:2,ticketConsulta:'stored'}))?.enviado).toBe(true);
  expect(h.client.sendSummary).not.toHaveBeenCalled();expect(h.client.getStatus).not.toHaveBeenCalled();expect(h.queue.encolarResumen).not.toHaveBeenCalled();
});

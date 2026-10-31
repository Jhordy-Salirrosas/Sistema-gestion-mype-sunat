/**
 * HU-04 — decisiones que NO son un fallo de red.
 *
 * Un rechazo de negocio del CDR no se reintenta ni va a la DLQ. Un error
 * inesperado (por ejemplo, no poder persistir el CDR) sí termina en la DLQ para
 * no perder el job.
 */
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import {
  crearDobles,
  paramsBase,
  rechazoDeNegocio,
  silenciarLogger,
  type Dobles,
} from './invoiceRetryTestSupport';

describe('HU-04 · InvoiceRetryService (decisiones)', () => {
  let dobles: Dobles;

  beforeEach(() => {
    silenciarLogger();
    dobles = crearDobles();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('no reintenta un rechazo de negocio del CDR', async () => {
    const { tx, queue, sleep, crearServicio } = dobles;
    const sendAndProcess = jest.fn().mockResolvedValue(rechazoDeNegocio());
    const sunat = { sendAndProcess } as unknown as SunatBillService;

    const resultado = await crearServicio(sunat).processWithRetry(paramsBase);

    expect(sendAndProcess).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(queue.sendToDlq).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
    expect(resultado.estado).toBe(InvoiceStatus.RECHAZADO);
    expect(resultado.reintentable).toBe(false);
  });

  it('manda a la DLQ si el envío lanza un error inesperado', async () => {
    const { tx, queue, sleep, crearServicio } = dobles;
    const sendAndProcess = jest
      .fn()
      .mockRejectedValue(new Error('No se pudo persistir el CDR'));
    const sunat = { sendAndProcess } as unknown as SunatBillService;

    const resultado = await crearServicio(sunat).processWithRetry(paramsBase);

    expect(sendAndProcess).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(resultado.enviadoADlq).toBe(true);
    expect(queue.sendToDlq).toHaveBeenCalledTimes(1);
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: paramsBase.invoiceId },
      data: { estado: InvoiceStatus.ERROR_RED },
      select: { company_id: true },
    });
    expect(queue.sendToDlq).toHaveBeenCalledWith(
      paramsBase.invoiceId,
      'company-test',
      expect.objectContaining({ estado: InvoiceStatus.ERROR_RED }),
    );
  });
});

import { fakeIssuerContext } from '../../fixtures/issuerContext';
import { SummaryDispatchService } from '../../../src/modules/invoices/application/services/summaryDispatchService';
import {
  SunatSummaryClient,
  SunatSummaryTransportError,
  construirSobreSendSummary,
} from '../../../src/modules/sunat/soap/sunatSummaryOperations';

describe('D1 summary issuer context and transport errors', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  const job = {
    companyId: 'fake-company',
    identificador: 'RC-20261101-001',
    fileName: '20000000001-RC-20261101-001.zip',
    zipBase64: Buffer.from('obviously-fake-zip').toString('base64'),
    tipo: 'RESUMEN_DIARIO',
  };
  it.each([true, false])(
    'propagates the company snapshot through send and polling, SOL present=%s',
    async (present) => {
      const context = fakeIssuerContext('fake-company', {
        sol: present ? fakeIssuerContext().sol : null,
      });
      const resolve = jest.fn(async () => context);
      const sendSummary = jest.fn(async () => ({ ticket: 'fake-ticket' }));
      const getStatus = jest.fn(async () => ({
        contenido: 'fake-cdr',
        statusCode: '0',
        enProceso: false,
      }));
      const service = new SummaryDispatchService(
        {} as never,
        { sendSummary, getStatus } as never,
        { resolve } as never,
      );
      const result = await service.procesar(job as never, {
        maxConsultas: 0,
        esperaMs: 0,
        credentials: { usuario: 'WRONG_FAKE_DEPLOY', clave: 'WRONG_FAKE' },
      });
      const credentials = present
        ? { usuario: context.sol!.username, clave: context.sol!.password }
        : null;
      expect(result.enviado).toBe(true);
      expect(resolve).toHaveBeenCalledWith(job.companyId);
      expect(sendSummary).toHaveBeenCalledWith(
        expect.objectContaining({ context, credentials }),
      );
      expect(getStatus).toHaveBeenCalledWith(
        'fake-ticket',
        credentials,
        context,
      );
    },
  );
  it('rejects a different fiscal identity before sending', async () => {
    const sendSummary = jest.fn();
    const service = new SummaryDispatchService(
      {} as never,
      { sendSummary } as never,
      { resolve: async () => fakeIssuerContext() } as never,
    );
    await expect(
      service.procesar({
        ...job,
        fileName: '20000000002-RC-fake.zip',
      } as never),
    ).rejects.toThrow('ISSUER_IDENTITY_MISMATCH');
    expect(sendSummary).not.toHaveBeenCalled();
  });
  it('stops before transport on resolver decryption failure', async () => {
    const sendSummary = jest.fn();
    const error = new Error('ISSUER_CONFIG_DECRYPTION_FAILED');
    const service = new SummaryDispatchService(
      {} as never,
      { sendSummary } as never,
      {
        resolve: async () => {
          throw error;
        },
      } as never,
    );
    await expect(service.procesar(job as never)).rejects.toBe(error);
    expect(sendSummary).not.toHaveBeenCalled();
  });
  it('sends both SOAP operations to the context endpoint with its timeout', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('<ticket>fake-ticket</ticket>'))
      .mockResolvedValueOnce(new Response('<statusCode>98</statusCode>'));
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    const context = fakeIssuerContext();
    const client = new SunatSummaryClient('http://127.0.0.1:2/unused', 500);
    await expect(
      client.sendSummary({
        fileName: job.fileName,
        zip: Buffer.from('fake'),
        context,
        credentials: {
          usuario: context.sol!.username,
          clave: context.sol!.password,
        },
      }),
    ).resolves.toMatchObject({ ticket: 'fake-ticket' });
    await expect(
      client.getStatus('fake-ticket', null, context),
    ).resolves.toMatchObject({ enProceso: true });
    expect(
      fetchMock.mock.calls.every(([url]) => url === context.endpoint),
    ).toBe(true);
    expect(timeout).toHaveBeenNthCalledWith(1, context.timeoutMs);
    expect(timeout).toHaveBeenNthCalledWith(2, context.timeoutMs);
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain(
      context.sol!.username,
    );
  });
  it('retains the injected deployment endpoint without a context', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('<statusCode>0</statusCode><content>fake-cdr</content>'),
      );
    const result = await new SunatSummaryClient(
      'http://127.0.0.1:2/billService',
    ).getStatus('fake-ticket');
    expect(result.contenido).toBe('fake-cdr');
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:2/billService');
  });
  it.each(['TimeoutError', 'AbortError', 'Error'])(
    'classifies transport rejection %s without sending again',
    async (name) => {
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(
          Object.assign(new Error('fake-network-error'), { name }),
        );
      await expect(
        new SunatSummaryClient('http://127.0.0.1:1').sendSummary({
          fileName: job.fileName,
          zip: Buffer.from('fake'),
          context: fakeIssuerContext(),
        }),
      ).rejects.toBeInstanceOf(SunatSummaryTransportError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    {
      operation: 'send',
      response: '<faultstring>fake-fault</faultstring>',
      status: 500,
    },
    { operation: 'send', response: '<empty/>', status: 503 },
    {
      operation: 'status',
      response: '<faultstring>fake-fault</faultstring>',
      status: 500,
    },
  ])(
    'classifies SOAP and HTTP failures: %j',
    async ({ operation, response, status }) => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(response, { status }));
      const client = new SunatSummaryClient('http://127.0.0.1:1');
      await expect(
        operation === 'send'
          ? client.sendSummary({
              fileName: job.fileName,
              zip: Buffer.from('fake'),
            })
          : client.getStatus('fake-ticket'),
      ).rejects.toBeInstanceOf(SunatSummaryTransportError);
    },
  );
  it('does not duplicate the RUC and escapes the supplied SOL identity', () => {
    const xml = construirSobreSendSummary({
      fileName: job.fileName,
      contentFileBase64: '',
      ruc: '20000000001',
      credentials: { usuario: '20000000001FAKE<&', clave: 'fake<&' },
    });
    expect(xml).toContain('20000000001FAKE&lt;&amp;');
    expect(xml).not.toContain('2000000000120000000001');
    expect(xml).toContain('fake&lt;&amp;');
  });
});

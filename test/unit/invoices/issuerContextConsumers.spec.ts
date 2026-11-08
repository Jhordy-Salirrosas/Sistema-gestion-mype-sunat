import { fakeIssuerContext } from '../../fixtures/issuerContext';
import { InvoiceAlertService } from '../../../src/modules/invoices/application/services/invoiceAlertService';
import { InvoiceDownloadService } from '../../../src/modules/invoices/application/services/invoiceDownloadService';
import { SummaryEnvioService } from '../../../src/modules/invoices/application/services/summaryEnvioService';
import { InvoiceWorkerService } from '../../../src/modules/invoices/invoiceWorkerService';

describe('D1 context consumers fail closed and preserve the company', () => {
  const context = fakeIssuerContext();
  it('checks the company certificate and scopes DLQ queries to that company', async () => {
    const resolve = jest.fn(async () => context);
    const inspectCertificate = jest.fn(() => ({
      validFrom: new Date('2020-01-01'),
      validTo: new Date('2099-01-01'),
      daysRemaining: 60,
    }));
    const countDlq = jest.fn(async () => 0),
      countDlqHuerfanos = jest.fn(async () => 0);
    const result = await new InvoiceAlertService(
      { inspectCertificate } as never,
      { countDlq, countDlqHuerfanos } as never,
      { resolve } as never,
    ).estado(context.companyId);
    expect(result.certificado.evaluado).toBe(true);
    expect(resolve).toHaveBeenCalledWith(context.companyId);
    expect(inspectCertificate).toHaveBeenCalledWith(context);
    expect(countDlq).toHaveBeenCalledWith(context.companyId);
    expect(countDlqHuerfanos).toHaveBeenCalledWith(context.companyId);
  });
  it('reports an unusable certificate without substituting a deployment certificate', async () => {
    const inspectCertificate = jest.fn(() => {
      throw new Error('fake-cert-unavailable');
    });
    const result = await new InvoiceAlertService(
      { inspectCertificate } as never,
      { countDlq: async () => 0, countDlqHuerfanos: async () => 0 } as never,
      { resolve: async () => context } as never,
    ).estado(context.companyId);
    expect(result.certificado.evaluado).toBe(false);
    expect(inspectCertificate).toHaveBeenCalledTimes(1);
    expect(inspectCertificate).toHaveBeenCalledWith(context);
  });
  it('does not hide a fiscal configuration decryption failure behind alerts', async () => {
    const inspectCertificate = jest.fn();
    const error = new Error('ISSUER_CONFIG_DECRYPTION_FAILED');
    const service = new InvoiceAlertService(
      { inspectCertificate } as never,
      {} as never,
      {
        resolve: async () => {
          throw error;
        },
      } as never,
    );
    await expect(service.estado(context.companyId)).rejects.toBe(error);
    expect(inspectCertificate).not.toHaveBeenCalled();
  });
  const download = (options: { saved?: string; error?: Error } = {}) => {
    const row = {
      id: 'fake-invoice',
      ruc_emisor: context.ruc,
      tipo_comprobante: '01',
      serie: 'F001',
      correlativo: 1,
      xml_storage_url: options.saved ?? null,
      payload_ubl: { fake: true },
    };
    const findFirst = jest.fn(async () => row);
    const signXml = jest.fn(() => {
      if (options.error) throw options.error;
      return { signedXml: '<?xml version="1.0"?><fake-signed/>' };
    });
    const guardar = jest.fn(async () => 'fake-hash');
    const resolve = jest.fn(async () => context);
    const service = new InvoiceDownloadService(
      { invoice: { findFirst } } as never,
      { generateInvoiceXml: () => '<Invoice/>' } as never,
      {} as never,
      {} as never,
      { verifySignature: jest.fn(() => true), signXml } as never,
      { guardar } as never,
      { resolve } as never,
    );
    return { verifySignature: jest.fn(() => true), service, findFirst, signXml, guardar, resolve };
  };
  it('regenerates downloads with the resolved issuer and stores that exact signed XML', async () => {
    const h = download();
    const file = await h.service.descargar(
      context.companyId,
      'fake-invoice',
      'xml',
    );
    expect(h.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fake-invoice', company_id: context.companyId },
      }),
    );
    expect(h.resolve).toHaveBeenCalledWith(context.companyId);
    expect(h.signXml).toHaveBeenCalledWith('<Invoice/>', context);
    expect(h.guardar).toHaveBeenCalledWith(
      'fake-invoice',
      file.contenido.toString(),
    );
  });
  it('keeps previously signed downloads unchanged', async () => {
    const saved = '<?xml version="1.0"?><fake-original/>';
    const h = download({ saved });
    expect(
      (
        await h.service.descargar(context.companyId, 'fake-invoice', 'xml')
      ).contenido.toString(),
    ).toBe(saved);
    expect(h.signXml).not.toHaveBeenCalled();
    expect(h.guardar).not.toHaveBeenCalled();
  });
  it('propagates signing failure instead of storing an unsigned reconstructed download', async () => {
    const error = new Error('fake-signing-error');
    const h = download({ error });
    await expect(
      h.service.descargar(context.companyId, 'fake-invoice', 'xml'),
    ).rejects.toBe(error);
    expect(h.guardar).not.toHaveBeenCalled();
  });
  it('resolves fiscal configuration before download signing and fails on decryption errors', async () => {
    const h = download();
    const error = new Error('ISSUER_CONFIG_DECRYPTION_FAILED');
    h.resolve.mockRejectedValueOnce(error);
    await expect(
      h.service.descargar(context.companyId, 'fake-invoice', 'xml'),
    ).rejects.toBe(error);
    expect(h.signXml).not.toHaveBeenCalled();
  });
  it.each(['summary', 'void'])(
    'passes company context to %s signing before enqueueing',
    async (type) => {
      const view = {
        envio: { identificador: 'RC-20261101-001' },
        lineas: [{ incluido: true }],
        errores: [],
        xml: '<SummaryDocuments/>',
      };
      const signXml = jest.fn(() => ({ signedXml: '<fake-signed/>' }));
      const encolar = jest.fn(async () => 'fake-job');
      const resolve = jest.fn(async () => context);
      const service = new SummaryEnvioService(
        {
          vistaResumenDiario: async () => view,
          vistaComunicacionBaja: async () => view,
        } as never,
        { encolar } as never,
        { verifySignature: jest.fn(() => true), signXml } as never,
        {
          company: { findUnique: async () => ({ ruc: context.ruc }) },
        } as never,
        { resolve } as never,
      );
      const result = await (type === 'summary'
        ? service.enviarResumenDiario(context.companyId, '2026-11-01')
        : service.enviarComunicacionBaja(context.companyId, '2026-11-01'));
      expect(result.enviado).toBe(true);
      expect(resolve).toHaveBeenCalledWith(context.companyId);
      expect(signXml).toHaveBeenCalledWith('<SummaryDocuments/>', context);
      expect(encolar).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: context.companyId }),
      );
    },
  );
  it('does not enqueue a summary when context resolution fails', async () => {
    const view = {
      envio: { identificador: 'RC-20261101-001' },
      lineas: [{ incluido: true }],
      errores: [],
      xml: '<SummaryDocuments/>',
    };
    const signXml = jest.fn(),
      encolar = jest.fn();
    const error = new Error('ISSUER_CONFIG_DECRYPTION_FAILED');
    const service = new SummaryEnvioService(
      { vistaResumenDiario: async () => view } as never,
      { encolar } as never,
      { verifySignature: jest.fn(() => true), signXml } as never,
      { company: { findUnique: async () => ({ ruc: context.ruc }) } } as never,
      {
        resolve: async () => {
          throw error;
        },
      } as never,
    );
    await expect(
      service.enviarResumenDiario(context.companyId, '2026-11-01'),
    ).rejects.toBe(error);
    expect(signXml).not.toHaveBeenCalled();
    expect(encolar).not.toHaveBeenCalled();
  });
  it.each(['success', 'missing-invoice', 'decrypt-error'])(
    'resolves the worker issuer from its persisted invoice: %s',
    async (mode) => {
      const findUnique = jest.fn(async () =>
        mode === 'missing-invoice' ? null : { company_id: context.companyId },
      );
      const signXml = jest.fn(() => ({ signedXml: '<fake-signed/>' }));
      const resolve = jest.fn(async (id: string) => {
        if (!id) throw new Error('ISSUER_COMPANY_REQUIRED');
        if (mode === 'decrypt-error')
          throw new Error('ISSUER_CONFIG_DECRYPTION_FAILED');
        return context;
      });
      const worker = new InvoiceWorkerService(
        {
          invoice: { findUnique, update: async () => ({}) },
          transactionHistory: { create: async () => ({}) },
        } as never,
        { generateInvoiceXml: () => '<Invoice/>' } as never,
        { validateInvoiceUbl21: () => ({ isValid: true }) } as never,
        { verifySignature: jest.fn(() => true), signXml } as never,
        { resolve } as never,
      );
      const result = await worker.processInvoiceJob({
        invoiceId: 'fake-invoice',
        payload: {} as never,
      });
      expect(resolve).toHaveBeenCalledWith(
        mode === 'missing-invoice' ? '' : context.companyId,
      );
      expect(result.success).toBe(mode === 'success');
      if (mode === 'success')
        expect(signXml).toHaveBeenCalledWith('<Invoice/>', context);
      else expect(signXml).not.toHaveBeenCalled();
    },
  );
});

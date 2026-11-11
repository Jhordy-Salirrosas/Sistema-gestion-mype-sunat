import { BadRequestException } from '@nestjs/common';
import { SalesReportController } from '../../../src/modules/invoices/infrastructure/controllers/salesReportController';

describe('SalesReportController', () => {
  it('delega el reporte y exige empresa', async () => {
    const service = { execute: jest.fn().mockResolvedValue({ totals: {} }) };
    const controller = new SalesReportController(service as never);
    await expect(controller.report('c1', '2026-11-01', '2026-11-30')).resolves.toEqual({ totals: {} });
    expect(service.execute).toHaveBeenCalledWith('c1', '2026-11-01', '2026-11-30');
    expect(() => controller.report(undefined)).toThrow(BadRequestException);
  });
});

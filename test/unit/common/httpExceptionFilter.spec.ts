import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from '../../../src/common/filters/httpExceptionFilter';

describe('HttpExceptionFilter (RFC 7807 Problem Details)', () => {
  let filter: HttpExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ url: '/api/v1/invoices' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('debe transformar una HttpException a RFC 7807 Problem Details', () => {
    const exception = new HttpException(
      { message: 'RUC inválido', detail: 'Dígito verificador erróneo' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('https://sync-sunat.pe/errors/'),
        title: expect.any(String),
        status: 400,
        detail: 'Dígito verificador erróneo',
        instance: '/api/v1/invoices',
      }),
    );
  });

  it('debe manejar errores no controlados como 500 RFC 7807', () => {
    const exception = new Error('Database connection failed');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
        detail: 'Database connection failed',
        instance: '/api/v1/invoices',
      }),
    );
  });
});

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

  it('no expone errores inesperados en respuestas ni logs', () => {
    const secret = 'clave-sol-ficticia-no-registrar';
    const exception = new Error(`SUNAT rechazó credencial ${secret}`);
    exception.stack = `Error: ${secret}`;
    const logger = (filter as unknown as { logger: { error: jest.Mock } })
      .logger;
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    const response = JSON.stringify(mockJson.mock.calls[0][0]);
    const logs = JSON.stringify(loggerSpy.mock.calls);
    expect(response).toContain('Ha ocurrido un error inesperado');
    expect(response).not.toContain(secret);
    expect(logs).not.toContain(secret);
    loggerSpy.mockRestore();
  });

  it('oculta el cuerpo de errores HTTP de servidor', () => {
    const secret = 'clave-sol-ficticia-no-registrar';
    const exception = new HttpException(
      { message: secret, detail: secret },
      HttpStatus.BAD_GATEWAY,
    );
    const logger = (filter as unknown as { logger: { error: jest.Mock } })
      .logger;
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();

    filter.catch(exception, mockHost);

    const response = JSON.stringify(mockJson.mock.calls[0][0]);
    const logs = JSON.stringify(loggerSpy.mock.calls);
    expect(response).not.toContain(secret);
    expect(response).toContain('Ha ocurrido un error inesperado');
    expect(logs).not.toContain(secret);
    loggerSpy.mockRestore();
  });
});

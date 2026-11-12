import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ClientSafeHttpException } from '../../../src/common/exceptions';
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

  it('conserva mensajes simples y normaliza arreglos de errores de validación', () => {
    filter.catch(new HttpException('Solicitud inválida', 400), mockHost);
    expect(mockJson).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: 'Solicitud inválida',
        message: 'Solicitud inválida',
      }),
    );

    filter.catch(new HttpException({ message: ['campo requerido'] }, 400), mockHost);
    expect(mockJson).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: 'Se detectaron errores de validación en la solicitud.',
        invalidParams: ['campo requerido'],
      }),
    );

    filter.catch(new HttpException({ message: 'Mensaje directo' }, 400), mockHost);
    expect(mockJson).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: 'Mensaje directo' }),
    );

    filter.catch(new HttpException(['error de campo'], 400), mockHost);
    expect(mockJson).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: 'Se detectaron errores de validación en la solicitud.',
        invalidParams: ['error de campo'],
      }),
    );

    filter.catch(
      new HttpException(null as unknown as Record<string, unknown>, 400),
      mockHost,
    );
    expect(mockJson).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('expone el mensaje redactado de un ClientSafeHttpException en un 5xx', () => {
    const exception = new ClientSafeHttpException(
      HttpStatus.SERVICE_UNAVAILABLE,
      'El servicio de colas no está disponible, por favor reintenta.',
    );
    const logger = (filter as unknown as { logger: { error: jest.Mock } })
      .logger;
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(503);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 503,
        detail: 'El servicio de colas no está disponible, por favor reintenta.',
        message: 'El servicio de colas no está disponible, por favor reintenta.',
        instance: '/api/v1/invoices',
      }),
    );
    const logs = JSON.stringify(loggerSpy.mock.calls);
    expect(logs).not.toContain('El servicio de colas no está disponible');
    loggerSpy.mockRestore();
  });

  it('mantiene genérico cualquier otro error de servidor', () => {
    const secret = 'cadena-de-conexion-con-password';
    const exception = new HttpException(
      { message: secret, detail: secret },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    const logger = (filter as unknown as { logger: { error: jest.Mock } })
      .logger;
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();

    filter.catch(exception, mockHost);

    const response = JSON.stringify(mockJson.mock.calls[0][0]);
    expect(response).toContain('Ha ocurrido un error inesperado');
    expect(response).not.toContain(secret);
    loggerSpy.mockRestore();
  });

  it('oculta excepciones de tipo desconocido', () => {
    const logger = (filter as unknown as { logger: { error: jest.Mock } })
      .logger;
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();

    filter.catch('error-ficticio', mockHost);

    expect(loggerSpy).toHaveBeenCalledWith('Error no controlado de tipo desconocido.');
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(JSON.stringify(mockJson.mock.calls.at(-1)?.[0])).not.toContain('error-ficticio');
    loggerSpy.mockRestore();
  });

  it('responde siempre con JSON aunque la excepción no se pueda inspeccionar', () => {
    const roto = {
      getStatus: () => {
        throw new Error('getStatus roto');
      },
    } as unknown as HttpException;
    const logger = (filter as unknown as { logger: { error: jest.Mock } })
      .logger;
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();

    filter.catch(roto, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = mockJson.mock.calls.at(-1)?.[0];
    expect(body).toEqual(
      expect.objectContaining({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'Ha ocurrido un error inesperado en el servidor.',
      }),
    );
    expect(JSON.stringify(body)).not.toContain('getStatus roto');
    loggerSpy.mockRestore();
  });
});

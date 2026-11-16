import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { EmitirComprobanteDto } from '../../src/modules/invoices/application/dto/emitirComprobanteDto';
import { NestFactory, type INestApplication } from '@nestjs/core';
import { bootstrap, applyGlobalValidation } from '../../src/main';
import { httpsOnlyMiddleware } from '../../src/common/middleware/httpsOnlyMiddleware';

describe('bootstrap', () => {
  const originalEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    corsOrigin: process.env.CORS_ORIGIN,
    port: process.env.PORT,
  };
  let app: {
    getHttpAdapter: jest.Mock;
    use: jest.Mock;
    enableCors: jest.Mock;
    useGlobalFilters: jest.Mock;
    useGlobalPipes: jest.Mock;
    listen: jest.Mock;
  };
  let setProxyTrust: jest.Mock;
  let createSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    setProxyTrust = jest.fn();
    app = {
      getHttpAdapter: jest.fn().mockReturnValue({
        getInstance: jest.fn().mockReturnValue({ set: setProxyTrust }),
      }),
      use: jest.fn(),
      enableCors: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalPipes: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    createSpy = jest
      .spyOn(NestFactory, 'create')
      .mockResolvedValue(app as unknown as INestApplication);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnvironment.nodeEnv;
    process.env.CORS_ORIGIN = originalEnvironment.corsOrigin;
    process.env.PORT = originalEnvironment.port;
    jest.restoreAllMocks();
  });

  it('enables proxy trust and HTTPS middleware only in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = ' https://first.example,https://second.example ';
    process.env.PORT = '3100';

    await bootstrap();

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(app.getHttpAdapter).toHaveBeenCalledTimes(1);
    expect(setProxyTrust).toHaveBeenCalledWith('trust proxy', 1);
    expect(app.use).toHaveBeenCalledWith(httpsOnlyMiddleware);
    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.arrayContaining([
          'https://first.example',
          'https://second.example',
        ]),
      }),
    );
    expect(app.listen).toHaveBeenCalledWith('3100', '0.0.0.0');
  });

  it('does not enable the production transport middleware in development', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.CORS_ORIGIN;
    delete process.env.PORT;

    await bootstrap();

    expect(app.getHttpAdapter).not.toHaveBeenCalled();
    expect(app.use).not.toHaveBeenCalled();
    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.arrayContaining(['http://localhost:5173']),
      }),
    );
    expect(app.listen).toHaveBeenCalledWith(3000, '0.0.0.0');
  });
});


describe('applyGlobalValidation: contrato de entrada y errores', () => {
  function configuredPipe() {
    let pipe: ValidationPipe | undefined;
    applyGlobalValidation({ useGlobalPipes: (value: ValidationPipe) => { pipe = value; } } as unknown as INestApplication);
    return pipe!;
  }
  const input = () => ({ tipo_comprobante: '08', serie: 'FD01', forma_pago: 'Contado',
    customer_legal_name: 'Cliente', customer_identity_type: '6', customer_identity_number: '20100070970',
    documento_afectado: 'F001-00000001', codigo_motivo_nota: '02',
    items: [{ codigo: 'SERV', descripcion: 'Servicio', cantidad: 1, precioUnitario: 35.4, unidad: 'NIU', afectacion: '10' }],
  });
  const metadata = { type: 'body' as const, metatype: EmitirComprobanteDto };
  it('transforma la entrada válida sin crear el campo interno', async () => {
    const result = await configuredPipe().transform(input(), metadata);
    expect(result).toBeInstanceOf(EmitirComprobanteDto);
    expect(result).not.toHaveProperty('saldoNotaCalculado');
    expect(result.items[0]).toMatchObject({ cantidad: 1, precioUnitario: 35.4 });
  });
  it.each(['saldoNotaCalculado', 'campoNoDeclarado'])('rechaza %s con el formato público y sin filtrar datos del cliente', async field => {
    const error = await configuredPipe().transform({ ...input(), [field]: { secreto: 'valor-no-publicable' } }, metadata).catch(e => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({ message: [{ field, rule: 'whitelistValidation', message: `property ${field} should not exist` }] });
    expect(JSON.stringify(error.getResponse())).not.toContain('valor-no-publicable');
  });
  it('formatea un error anidado sin constraints en el padre con el mensaje seguro de respaldo', async () => {
    const body = input(); body.items[0].cantidad = 0;
    const error = await configuredPipe().transform(body, metadata).catch(e => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toMatchObject({ message: [{ field: 'items', rule: undefined, message: 'Dato inválido' }] });
  });
});

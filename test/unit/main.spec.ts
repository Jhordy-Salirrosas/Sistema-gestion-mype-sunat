import { NestFactory, type INestApplication } from '@nestjs/core';
import { bootstrap } from '../../src/main';
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

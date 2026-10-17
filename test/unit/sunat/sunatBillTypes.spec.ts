import { resolveEndpoint } from '../../../src/modules/sunat/soap/sunatBillTypes';
import { SUNAT_BILL_SERVICE_URLS } from '../../../src/modules/sunat/soap/soap.constants';

const envKeys = [
  'SUNAT_BILL_SERVICE_URL',
  'SUNAT_BILL_SERVICE_URL_BETA',
  'SUNAT_BILL_SERVICE_URL_PRODUCCION',
  'SUNAT_ENV',
] as const;

describe('resolveEndpoint', () => {
  const previousValues = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of envKeys) {
      previousValues.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const previous = previousValues.get(key);
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it('usa el endpoint Beta por defecto', () => {
    expect(resolveEndpoint()).toBe(SUNAT_BILL_SERVICE_URLS.beta);
  });

  it('selecciona Producción solo si el entorno se configura explícitamente', () => {
    process.env.SUNAT_ENV = 'produccion';
    expect(resolveEndpoint()).toBe(SUNAT_BILL_SERVICE_URLS.produccion);
  });

  it('usa el endpoint del entorno configurado', () => {
    process.env.SUNAT_BILL_SERVICE_URL_BETA =
      'https://beta.example.test/billService';
    expect(resolveEndpoint()).toBe('https://beta.example.test/billService');

    process.env.SUNAT_ENV = 'produccion';
    process.env.SUNAT_BILL_SERVICE_URL_PRODUCCION =
      'https://production.example.test/billService';
    expect(resolveEndpoint()).toBe(
      'https://production.example.test/billService',
    );
  });

  it('respeta primero el endpoint explícito para mocks o destinos autorizados', () => {
    process.env.SUNAT_BILL_SERVICE_URL = 'http://localhost:3000/billService';
    process.env.SUNAT_ENV = 'produccion';
    expect(resolveEndpoint()).toBe('http://localhost:3000/billService');
  });
});

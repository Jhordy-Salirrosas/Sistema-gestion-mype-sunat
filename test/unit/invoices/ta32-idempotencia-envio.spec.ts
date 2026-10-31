/**
 * TA-32 — Idempotencia del envío.
 *
 * Cubre los tres frentes que implementa la rama:
 *   1. Llave de idempotencia del repositorio (criterio 1 y 2).
 *   2. Conciliación con SUNAT antes de reintentar por timeout (criterio 3).
 *   3. Peticiones simultáneas del mismo comprobante (doble clic de la UI).
 *
 * Las pruebas de repositorio usan dobles de Prisma: no tocan la base real.
 */
import { ConflictException } from '@nestjs/common';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import {
  construirClaveIdempotencia,
  RegistroEnVuelo,
} from '../../../src/modules/invoices/application/services/invoiceIdempotency';
import {
  requiereConciliacion,
  resultadoTrasConciliacion,
} from '../../../src/modules/invoices/application/services/invoiceReconciliation';
import { PrismaInvoiceRepository } from '../../../src/modules/invoices/infrastructure/persistence/prismaInvoiceRepository';
import { InvoiceEntity } from '../../../src/modules/invoices/domain/entities/invoiceEntity';
import { SunatTransportError } from '../../../src/modules/sunat/soap/sunat-soap.client';
import type { ProcessCdrResult } from '../../../src/modules/sunat/soap/sunatBillTypes';

const CAMPOS = {
  companyId: 'empresa-1',
  rucEmisor: '20601012341',
  tipoComprobante: '01',
  serie: 'F001',
  correlativo: 7,
};

function entidad(): InvoiceEntity {
  return new InvoiceEntity({
    company_id: CAMPOS.companyId,
    ruc_emisor: CAMPOS.rucEmisor,
    serie: CAMPOS.serie,
    correlativo: CAMPOS.correlativo,
    tipo_comprobante: CAMPOS.tipoComprobante,
    monto_total: 118,
    fecha_emision: new Date('2026-10-30T00:00:00Z'),
    payload_ubl: {},
    clave_idempotencia: construirClaveIdempotencia(CAMPOS),
  });
}

/** Error P2002 tal como lo entrega Prisma. */
function errorP2002(target: string[]) {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { target },
  });
}

/** Variante con `meta.target` en cualquiera de las formas que reporta Prisma. */
function errorP2002ConTarget(target: unknown) {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { target },
  });
}

const RESULTADO_INCIERTO: ProcessCdrResult = {
  invoiceId: 'inv-1',
  responseCode: '',
  estado: InvoiceStatus.ENVIADO,
  valido: false,
  reintentable: true,
  clasificacion: {
    status: InvoiceStatus.ENVIADO,
    kind: 'DESCONOCIDO',
    valido: false,
    reintentable: true,
  },
  cdr: null,
  tiempoRespuestaMs: null,
  error: 'Timeout de 30000 ms esperando al billService',
};

describe('TA-32 - clave de idempotencia', () => {
  it('es determinista para el mismo comprobante', () => {
    expect(construirClaveIdempotencia(CAMPOS)).toBe(
      construirClaveIdempotencia({ ...CAMPOS }),
    );
  });

  it('normaliza serie y tipo: f001 y F001 son el mismo comprobante', () => {
    expect(
      construirClaveIdempotencia({ ...CAMPOS, serie: 'f001' }),
    ).toBe(construirClaveIdempotencia({ ...CAMPOS, serie: 'F001' }));
  });

  it('cambia si cambia el correlativo', () => {
    expect(
      construirClaveIdempotencia({ ...CAMPOS, correlativo: 8 }),
    ).not.toBe(construirClaveIdempotencia(CAMPOS));
  });

  it('separa empresas distintas: la misma serie no colisiona entre tenants', () => {
    expect(
      construirClaveIdempotencia({ ...CAMPOS, companyId: 'empresa-2' }),
    ).not.toBe(construirClaveIdempotencia(CAMPOS));
  });

  it('produce una huella hexadecimal de 64 caracteres', () => {
    expect(construirClaveIdempotencia(CAMPOS)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('TA-32 - peticiones simultáneas del mismo comprobante', () => {
  it('ejecuta el trabajo una sola vez por clave', async () => {
    const registro = new RegistroEnVuelo<string>();
    let llamadas = 0;

    const trabajo = async () => {
      llamadas += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'comprobante-1';
    };

    const [a, b] = await Promise.all([
      registro.ejecutar('clave', trabajo),
      registro.ejecutar('clave', trabajo),
    ]);

    expect(llamadas).toBe(1);
    expect(a).toBe('comprobante-1');
    expect(b).toBe('comprobante-1');
  });

  it('vuelve a ejecutar cuando la clave ya terminó (reintento legítimo)', async () => {
    const registro = new RegistroEnVuelo<number>();
    let llamadas = 0;
    const trabajo = async () => {
      llamadas += 1;
      return llamadas;
    };

    await registro.ejecutar('clave', trabajo);
    await registro.ejecutar('clave', trabajo);

    expect(llamadas).toBe(2);
    expect(registro.tamano).toBe(0);
  });

  it('libera la clave aunque el trabajo falle', async () => {
    const registro = new RegistroEnVuelo<never>();
    const trabajo = async () => {
      throw new Error('fallo');
    };

    await expect(registro.ejecutar('clave', trabajo)).rejects.toThrow('fallo');
    expect(registro.tamano).toBe(0);
  });
});

describe('TA-32 - repositorio y llave única', () => {
  function crearRepositorio(errorDeCarga: unknown, existente?: unknown) {
    const prisma = {
      $transaction: async () => {
        throw errorDeCarga;
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(existente ?? null),
      },
    };
    const queue = { enqueueInvoiceInTx: jest.fn() };
    return new PrismaInvoiceRepository(
      prisma as never,
      queue as never,
    );
  }

  it('devuelve el registro existente (200) cuando choca la llave de idempotencia', async () => {
    const existente = {
      id: 'inv-existente',
      estado: InvoiceStatus.PENDIENTE,
      created_at: new Date('2026-10-30T10:00:00Z'),
    };
    const repo = crearRepositorio(
      errorP2002([
        'company_id',
        'ruc_emisor',
        'tipo_comprobante',
        'serie',
        'correlativo',
      ]),
      existente,
    );

    await expect(repo.saveWithTransactionalOutbox(entidad())).resolves.toBe(
      existente,
    );
  });

  it('responde 409 cuando la serie ya está tomada (uq_invoices_fiscal)', async () => {
    const repo = crearRepositorio(
      errorP2002(['company_id', 'tipo_comprobante', 'serie', 'correlativo']),
    );

    await expect(repo.saveWithTransactionalOutbox(entidad())).rejects.toThrow(
      ConflictException,
    );
  });

  it('responde 409 si la llave de idempotencia choca pero el registro ya no está', async () => {
    const repo = crearRepositorio(
      errorP2002(['company_id', 'ruc_emisor', 'serie', 'correlativo']),
      null,
    );

    await expect(repo.saveWithTransactionalOutbox(entidad())).rejects.toThrow(
      ConflictException,
    );
  });

  it('responde OUTBOX_WRITE_FAILED ante un fallo que no es de unicidad', async () => {
    const repo = crearRepositorio(new Error('connection terminated'));

    await expect(repo.saveWithTransactionalOutbox(entidad())).rejects.toThrow(
      /No se pudo registrar el comprobante/,
    );
  });

  it('reconoce la llave cuando Prisma reporta el target como string', async () => {
    const existente = {
      id: 'inv-existente',
      estado: InvoiceStatus.PENDIENTE,
      created_at: new Date('2026-10-30T10:00:00Z'),
    };
    const repo = crearRepositorio(
      errorP2002ConTarget(
        'correlativo, company_id, serie, tipo_comprobante, ruc_emisor',
      ),
      existente,
    );

    await expect(repo.saveWithTransactionalOutbox(entidad())).resolves.toBe(
      existente,
    );
  });

  it('responde 409 si choca la llave completa y el registro ya no está', async () => {
    const repo = crearRepositorio(
      errorP2002([
        'company_id',
        'ruc_emisor',
        'tipo_comprobante',
        'serie',
        'correlativo',
      ]),
      null,
    );

    await expect(repo.saveWithTransactionalOutbox(entidad())).rejects.toThrow(
      ConflictException,
    );
  });

  it('trata un P2002 sin target como un choque que no es de idempotencia', async () => {
    const repo = crearRepositorio(errorP2002ConTarget(undefined), null);

    await expect(repo.saveWithTransactionalOutbox(entidad())).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('TA-32 - conciliación antes de reintentar (criterio 3)', () => {
  it('pide conciliar cuando el intento anterior quedó incierto', () => {
    expect(requiereConciliacion(RESULTADO_INCIERTO, null)).toBe(true);
  });

  it('pide conciliar cuando el error es un timeout de transporte', () => {
    const error = new SunatTransportError(
      'Timeout de 30000 ms esperando al billService',
    );
    expect(requiereConciliacion(null, error)).toBe(true);
  });

  it('no concilia un rechazo de negocio del CDR', () => {
    const rechazado: ProcessCdrResult = {
      ...RESULTADO_INCIERTO,
      estado: InvoiceStatus.RECHAZADO,
      reintentable: false,
      responseCode: '2326',
    };
    expect(requiereConciliacion(rechazado, null)).toBe(false);
  });

  it('devuelve el CDR recuperado cuando SUNAT sí tenía el comprobante', () => {
    const recuperado: ProcessCdrResult = {
      ...RESULTADO_INCIERTO,
      estado: InvoiceStatus.ACEPTADO,
      valido: true,
      reintentable: false,
      responseCode: '0',
      cdr: {
        id: 'cdr-1',
        responseCode: '0',
        description: 'Aceptado',
        referenceId: 'F001-7',
        observaciones: [],
        responseDate: null,
        responseTime: null,
        ublVersion: null,
        xmlFileName: null,
        rawXml: '<ApplicationResponse/>',
      },
    };

    expect(resultadoTrasConciliacion(recuperado)).toBe(recuperado);
  });

  it('devuelve null (reenviar es seguro) cuando SUNAT no lo tenía', () => {
    expect(resultadoTrasConciliacion(null)).toBeNull();
  });

  it('devuelve null cuando la consulta también falló por red', () => {
    expect(resultadoTrasConciliacion(RESULTADO_INCIERTO)).toBeNull();
  });
});

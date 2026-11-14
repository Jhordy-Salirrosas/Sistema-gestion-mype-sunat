import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { IUserRepositoryPort } from '../../../src/modules/auth/domain/ports/userRepositoryPort';
import type { TokenPayload } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import {
  SireHistorialQueryDto,
  SireImportacionRequestDto,
  SirePeriodoQueryDto,
  SireReporteRequestDto,
} from '../../../src/modules/sire/application/dto/sireMenuQueryDto';
import { SireMenuController } from '../../../src/modules/sire/infrastructure/controllers/sireMenuController';

const USUARIO: TokenPayload = {
  sub: 'user-id',
  email: 'demo@example.test',
  companyId: 'company-id',
  role: 'ADMIN',
};

const RUC = '20601030013';

function crearController() {
  const importar = { execute: jest.fn().mockResolvedValue({ messageId: 'm1' }) };
  const conciliar = { execute: jest.fn().mockResolvedValue({ conciliacionId: 'c1' }) };
  const consultarImportacion = { execute: jest.fn().mockResolvedValue({ estado: 'PENDING' }) };
  const resumen = { execute: jest.fn().mockResolvedValue({ periodo: '202401' }) };
  const reportar = { execute: jest.fn().mockResolvedValue({ messageId: 'm2' }) };
  const consultarReporte = { execute: jest.fn().mockResolvedValue({ estado: 'PENDING' }) };
  const historial = { execute: jest.fn().mockResolvedValue({ total: 0, filas: [] }) };
  const users = {
    findCompanyById: jest.fn().mockResolvedValue({ id: 'company-id', ruc: RUC }),
  };

  const controller = new SireMenuController(
    importar as never,
    conciliar as never,
    consultarImportacion as never,
    resumen as never,
    reportar as never,
    consultarReporte as never,
    historial as never,
    users as unknown as IUserRepositoryPort,
  );

  return {
    controller,
    importar,
    conciliar,
    consultarImportacion,
    resumen,
    reportar,
    consultarReporte,
    historial,
    users,
  };
}

describe('SireMenuController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('imports a proposal with the RUC taken from the session, never from the request', async () => {
    const { controller, importar, users } = crearController();

    await controller.importar(
      {},
      {
        originalname: `LE${RUC}-RCE-202401.zip`,
        mimetype: 'application/octet-stream',
        buffer: Buffer.from('contenido'),
      },
      USUARIO,
    );

    expect(users.findCompanyById).toHaveBeenCalledWith('company-id');
    expect(importar.execute).toHaveBeenCalledWith(
      'company-id',
      RUC,
      {},
      expect.objectContaining({ originalname: `LE${RUC}-RCE-202401.zip` }),
    );
  });

  it('refuses to import without an authenticated company', async () => {
    const { controller, importar } = crearController();

    await expect(
      controller.importar(
        {},
        {
          originalname: 'LE20601030013-RCE-202401.zip',
          mimetype: 'application/octet-stream',
          buffer: Buffer.from('x'),
        },
        undefined,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(importar.execute).not.toHaveBeenCalled();
  });

  it('refuses to import without a file', async () => {
    const { controller } = crearController();

    await expect(
      controller.importar({}, undefined, USUARIO),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reconciles the requested period scoped to the session company', async () => {
    const { controller, conciliar } = crearController();

    await controller.conciliacion(
      { periodo: '202401', libro: 'RCE_COMPRAS' },
      USUARIO,
    );

    expect(conciliar.execute).toHaveBeenCalledWith(
      'company-id',
      '202401',
      'RCE_COMPRAS',
    );
  });

  it('returns the summary of the requested period', async () => {
    const { controller, resumen } = crearController();

    await controller.resumen({ periodo: '202401' }, USUARIO);

    expect(resumen.execute).toHaveBeenCalledWith('company-id', '202401', null);
  });

  it('sends the book to SUNAT and returns the ticket', async () => {
    const { controller, reportar } = crearController();

    await controller.reportar(
      { periodo: '202401', libro: 'RVIE_VENTAS' },
      USUARIO,
    );

    expect(reportar.execute).toHaveBeenCalledWith('company-id', {
      periodo: '202401',
      libro: 'RVIE_VENTAS',
    });
  });

  it('answers the polling of an import and of a report', async () => {
    const { controller, consultarImportacion, consultarReporte } =
      crearController();

    await controller.estadoImportacion('m1', USUARIO);
    await controller.estadoReporte('m2', USUARIO);

    expect(consultarImportacion.execute).toHaveBeenCalledWith(
      'company-id',
      'm1',
    );
    expect(consultarReporte.execute).toHaveBeenCalledWith('company-id', 'm2');
  });

  it('returns the unified history', async () => {
    const { controller, historial } = crearController();

    await controller.historial({ periodo: '202401', limite: 20 }, USUARIO);

    expect(historial.execute).toHaveBeenCalledWith(
      'company-id',
      '202401',
      20,
    );
  });
});

describe('DTOs del menú SIRE', () => {
  it('accepts a valid period and book', async () => {
    await expect(
      validate(
        plainToInstance(SirePeriodoQueryDto, {
          periodo: '202401',
          libro: 'RCE_COMPRAS',
        }),
      ),
    ).resolves.toHaveLength(0);

    await expect(
      validate(
        plainToInstance(SireReporteRequestDto, {
          periodo: '202401',
          libro: 'RVIE_VENTAS',
        }),
      ),
    ).resolves.toHaveLength(0);
  });

  it('accepts an import without a period or a book', async () => {
    await expect(
      validate(plainToInstance(SireImportacionRequestDto, {})),
    ).resolves.toHaveLength(0);
  });

  it.each([
    { periodo: '2024', libro: 'RCE_COMPRAS' },
    { periodo: '202413', libro: 'RCE_COMPRAS' },
    { periodo: '202401', libro: 'LIBRO_INVENTADO' },
  ])('rejects an invalid period or book', async (input) => {
    const errors = await validate(plainToInstance(SirePeriodoQueryDto, input));

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a limit outside the allowed range', async () => {
    await expect(
      validate(plainToInstance(SireHistorialQueryDto, { limite: 0 })),
    ).resolves.not.toHaveLength(0);
    await expect(
      validate(plainToInstance(SireHistorialQueryDto, { limite: 5000 })),
    ).resolves.not.toHaveLength(0);
    await expect(
      validate(plainToInstance(SireHistorialQueryDto, { limite: 50 })),
    ).resolves.toHaveLength(0);
  });
});

import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
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
    await expect(
      controller.importar(
        {},
        { originalname: 'LE.zip', mimetype: 'application/zip', buffer: undefined as never },
        USUARIO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects all endpoints when session has no company', async () => {
    const { controller } = crearController();
    const userSinEmpresa = { ...USUARIO, companyId: undefined as never };

    await expect(controller.estadoImportacion('m1', undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.estadoImportacion('m1', userSinEmpresa)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.estadoImportacion('m1')).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(controller.conciliacion({ periodo: '202401' }, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.conciliacion({ periodo: '202401' }, userSinEmpresa)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.conciliacion({ periodo: '202401' })).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(controller.resumen({ periodo: '202401' }, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.resumen({ periodo: '202401' }, userSinEmpresa)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.resumen({ periodo: '202401' })).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(controller.reportar({ periodo: '202401', libro: 'RVIE_VENTAS' }, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.reportar({ periodo: '202401', libro: 'RVIE_VENTAS' }, userSinEmpresa)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.reportar({ periodo: '202401', libro: 'RVIE_VENTAS' })).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(controller.estadoReporte('m2', undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.estadoReporte('m2', userSinEmpresa)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.estadoReporte('m2')).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(controller.historial({}, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.historial({}, userSinEmpresa)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.historial({})).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(controller.importar({}, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
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

  it('reconciles without a book so the use case applies its default', async () => {
    const { controller, conciliar } = crearController();

    await controller.conciliacion({ periodo: '202401' }, USUARIO);

    expect(conciliar.execute).toHaveBeenCalledWith(
      'company-id',
      '202401',
      null,
    );
  });

  it('returns the unified history without period or limit', async () => {
    const { controller, historial } = crearController();

    await controller.historial({}, USUARIO);

    expect(historial.execute).toHaveBeenCalledWith(
      'company-id',
      null,
      null,
    );
  });

  it('fails the import when the company of the session does not exist', async () => {
    const { controller, users, importar } = crearController();
    (users.findCompanyById as jest.Mock).mockResolvedValue(null);

    await expect(
      controller.importar(
        {},
        {
          originalname: `LE${RUC}-RCE-202401.zip`,
          mimetype: 'application/octet-stream',
          buffer: Buffer.from('contenido'),
        },
        USUARIO,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(importar.execute).not.toHaveBeenCalled();
  });
});

describe('Filtro de extensiones del archivo SIRE', () => {
  function obtenerFileFilter(): (
    request: unknown,
    file: { originalname: string },
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => void {
    const interceptors = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      SireMenuController.prototype.importar,
    );
    const MixinInterceptor = interceptors[0] as new () => {
      multer: { fileFilter: unknown };
    };

    return (new MixinInterceptor() as { multer: { fileFilter: never } }).multer
      .fileFilter as never;
  }

  it('accepts the allowed extensions in a case-insensitive way', () => {
    const fileFilter = obtenerFileFilter();
    const callback = jest.fn();

    fileFilter({}, { originalname: `LE${RUC}-RCE-202401.ZIP` }, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('accepts any extension when SKIP_FILE_VALIDATION=true', () => {
    const original = process.env.SKIP_FILE_VALIDATION;
    process.env.SKIP_FILE_VALIDATION = 'true';
    try {
      const fileFilter = obtenerFileFilter();
      const callback = jest.fn();

      fileFilter({}, { originalname: 'propuesta.pdf' }, callback);

      expect(callback).toHaveBeenCalledWith(null, true);
    } finally {
      if (original === undefined) delete process.env.SKIP_FILE_VALIDATION;
      else process.env.SKIP_FILE_VALIDATION = original;
    }
  });

  it('rejects a file with an extension that is not allowed', () => {
    const fileFilter = obtenerFileFilter();
    const callback = jest.fn();

    fileFilter({}, { originalname: 'propuesta.exe' }, callback);

    expect(callback).toHaveBeenCalledWith(
      expect.any(BadRequestException),
      false,
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

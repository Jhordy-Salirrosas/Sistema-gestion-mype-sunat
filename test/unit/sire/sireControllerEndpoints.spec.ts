import {
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { SireController } from '../../../src/modules/sire/infrastructure/controllers/sireController';
import type { TokenPayload } from '../../../src/modules/auth/domain/ports/tokenServicePort';

const USER: TokenPayload = {
  sub: 'user-1',
  email: 'user@example.test',
  companyId: 'company-1',
  role: 'ACCOUNTANT',
};

const DTO = { period: '202610', bookType: 'RCE_COMPRAS' as const };

type Filtro = (
  request: unknown,
  file: { originalname: string; mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) => void;

function filtroDe(metodo: string): Filtro {
  const interceptores = Reflect.getMetadata(
    '__interceptors__',
    SireController.prototype[metodo],
  ) as Array<new (options: object) => { multer: { fileFilter: Filtro } }>;
  const Interceptor = interceptores[0];
  const instancia = new Interceptor({});

  return instancia.multer.fileFilter;
}

describe('SireController - endpoints y filtros de carga', () => {
  const casos = {
    ingest: { execute: jest.fn() },
    export: { execute: jest.fn() },
    history: { execute: jest.fn() },
    close: { execute: jest.fn() },
    uploadReport: { execute: jest.fn() },
    getProposal: { execute: jest.fn() },
    exclude: { execute: jest.fn() },
    replace: { execute: jest.fn() },
    register: { execute: jest.fn() },
    remove: { execute: jest.fn() },
    generate: { execute: jest.fn() },
    tickets: { getPeriod: jest.fn(), getRecords: jest.fn(), poll: jest.fn() },
    accept: { execute: jest.fn() },
    restore: { execute: jest.fn() },
  };

  let controller: SireController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SireController(
      { execute: jest.fn() } as never,
      casos.ingest as never,
      casos.export as never,
      casos.history as never,
      casos.close as never,
      casos.uploadReport as never,
      casos.getProposal as never,
      casos.exclude as never,
      casos.replace as never,
      casos.register as never,
      casos.remove as never,
      casos.generate as never,
      casos.tickets as never,
      casos.accept as never,
      casos.restore as never,
    );
  });

  describe('importación de la propuesta', () => {
    it('delega la carga del archivo TXT con la empresa autenticada', async () => {
      const file = {
        originalname: 'propuesta.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('contenido'),
      };

      await controller.importProposal(DTO, file, USER);

      expect(casos.ingest.execute).toHaveBeenCalledWith(
        DTO,
        'company-1',
        file.buffer,
      );
    });

    it('rechaza la petición cuando no llega el archivo', async () => {
      await expect(
        controller.importProposal(DTO, undefined, USER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(casos.ingest.execute).not.toHaveBeenCalled();
    });
  });

  describe('reemplazo de la propuesta', () => {
    it('delega el reemplazo del archivo TXT', async () => {
      const file = {
        originalname: 'propuesta.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('contenido'),
      };

      await controller.replaceProposal(DTO, file, USER);

      expect(casos.replace.execute).toHaveBeenCalledWith(
        DTO,
        'company-1',
        file.buffer,
      );
    });

    it('rechaza el reemplazo cuando no llega el archivo', async () => {
      await expect(
        controller.replaceProposal(DTO, undefined, USER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(casos.replace.execute).not.toHaveBeenCalled();
    });
  });

  describe('operaciones del contrato', () => {
    it('devuelve la propuesta por POST', async () => {
      await controller.getProposal(DTO, USER);

      expect(casos.getProposal.execute).toHaveBeenCalledWith(DTO, 'company-1');
    });

    it('excluye la propuesta por su identificador', async () => {
      await controller.excludeProposal('proposal-1', USER);

      expect(casos.exclude.execute).toHaveBeenCalledWith(
        'company-1',
        'proposal-1',
        'user-1',
      );
    });

    it('registra la propuesta preliminar', async () => {
      await controller.registerPreliminary(DTO, USER);

      expect(casos.register.execute).toHaveBeenCalledWith(DTO, 'company-1');
    });

    it('genera el registro de la propuesta', async () => {
      await controller.generate(DTO, USER);

      expect(casos.generate.execute).toHaveBeenCalledWith(DTO, 'company-1');
    });

    it('cierra el periodo fiscal', async () => {
      await controller.close(DTO, USER);

      expect(casos.close.execute).toHaveBeenCalledWith(DTO, 'company-1');
    });

    it('devuelve el historial de conciliaciones', async () => {
      const query = { period: '202610', bookType: 'RCE_COMPRAS' } as never;

      await controller.history(query, USER);

      expect(casos.history.execute).toHaveBeenCalledWith(query, 'company-1');
    });
  });

  describe('sondeo del ticket', () => {
    it('sondea el ticket de un libro válido', async () => {
      await controller.pollTicket('202610', 'RCE_COMPRAS', USER);

      expect(casos.tickets.poll).toHaveBeenCalledWith(
        'company-1',
        '202610',
        'RCE_COMPRAS',
      );
    });

    it('rechaza un tipo de libro que no existe', async () => {
      await expect(
        controller.pollTicket('202610', 'OTRO' as never, USER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(casos.tickets.poll).not.toHaveBeenCalled();
    });
  });

  describe('exportación de la propuesta', () => {
    it('responde con el archivo generado', async () => {
      casos.export.execute.mockResolvedValue({
        fileName: 'propuesta.txt',
        content: 'contenido',
      });

      const respuesta = {
        status: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        attachment: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };

      await controller.exportProposal(DTO, USER, respuesta as never);

      expect(casos.export.execute).toHaveBeenCalledWith(DTO, 'company-1');
      expect(respuesta.status).toHaveBeenCalledWith(200);
      expect(respuesta.type).toHaveBeenCalledWith('text/plain; charset=utf-8');
      expect(respuesta.attachment).toHaveBeenCalledWith('propuesta.txt');
      expect(respuesta.send).toHaveBeenCalledWith(Buffer.from('contenido'));
    });
  });

  describe('filtro de los archivos TXT', () => {
    it('acepta un TXT de texto plano', () => {
      const callback = jest.fn();

      filtroDe('importProposal')(
        {},
        { originalname: 'propuesta.txt', mimetype: 'text/plain' },
        callback,
      );

      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('acepta un TXT enviado como octet-stream', () => {
      const callback = jest.fn();

      filtroDe('importProposal')(
        {},
        {
          originalname: 'propuesta.txt',
          mimetype: 'application/octet-stream',
        },
        callback,
      );

      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('rechaza un archivo que no es TXT', () => {
      const callback = jest.fn();

      filtroDe('importProposal')(
        {},
        { originalname: 'propuesta.pdf', mimetype: 'text/plain' },
        callback,
      );

      const [error, aceptado] = callback.mock.calls[0];
      expect(error).toBeInstanceOf(BadRequestException);
      expect(aceptado).toBe(false);
    });

    it('rechaza un TXT con un tipo de contenido que no es texto', () => {
      const callback = jest.fn();

      filtroDe('importProposal')(
        {},
        { originalname: 'propuesta.txt', mimetype: 'application/pdf' },
        callback,
      );

      const [error, aceptado] = callback.mock.calls[0];
      expect(error).toBeInstanceOf(BadRequestException);
      expect(aceptado).toBe(false);
    });
  });

  describe('filtro de los archivos CSV o XLSX', () => {
    it('acepta un CSV', () => {
      const callback = jest.fn();

      filtroDe('uploadReport')(
        {},
        { originalname: 'reporte.csv', mimetype: 'text/csv' },
        callback,
      );

      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('acepta un XLSX', () => {
      const callback = jest.fn();

      filtroDe('uploadReport')(
        {},
        {
          originalname: 'reporte.xlsx',
          mimetype: 'application/octet-stream',
        },
        callback,
      );

      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('rechaza un archivo que no es CSV ni XLSX', () => {
      const callback = jest.fn();

      filtroDe('uploadReport')(
        {},
        { originalname: 'reporte.txt', mimetype: 'text/plain' },
        callback,
      );

      const [error, aceptado] = callback.mock.calls[0];
      expect(error).toBeInstanceOf(UnsupportedMediaTypeException);
      expect(aceptado).toBe(false);
    });
  });
});

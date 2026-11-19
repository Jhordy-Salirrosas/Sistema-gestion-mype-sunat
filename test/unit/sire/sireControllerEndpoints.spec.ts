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
    uploadReport: { execute: jest.fn() },
    getProposal: { execute: jest.fn() },
    tickets: { getPeriod: jest.fn(), getRecords: jest.fn() },
  };

  let controller: SireController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SireController(
      { execute: jest.fn() } as never,
      casos.ingest as never,
      casos.export as never,
      casos.history as never,
      casos.uploadReport as never,
      casos.getProposal as never,
      casos.tickets as never,
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

  describe('operaciones locales del contrato', () => {
    it('devuelve la propuesta por GET', async () => {
      await controller.getPropuesta(
        { ruc: '20123456789', periodo: '202610', libro: 'RCE' },
        USER,
      );

      expect(casos.getProposal.execute).toHaveBeenCalledWith(DTO, 'company-1');
    });

    it('devuelve el historial de conciliaciones', async () => {
      const query = { period: '202610', bookType: 'RCE_COMPRAS' } as never;

      await controller.history(query, USER);

      expect(casos.history.execute).toHaveBeenCalledWith(query, 'company-1');
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

import type { PrismaService } from '../../../src/database/prismaService';
import { SireMenuRepository } from '../../../src/modules/sire/infrastructure/persistence/sireMenuRepository';

const COMPANY_ID = 'company-id';

function crearPrisma() {
  return {
    sireImportacion: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    sireConciliacion: {
      create: jest.fn(),
      count: jest.fn(),
    },
    sireReporte: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  } as unknown as PrismaService & {
    sireImportacion: Record<string, jest.Mock>;
    sireConciliacion: Record<string, jest.Mock>;
    sireReporte: Record<string, jest.Mock>;
    $queryRaw: jest.Mock;
  };
}

describe('SireMenuRepository', () => {
  let prisma: ReturnType<typeof crearPrisma>;
  let repository: SireMenuRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = crearPrisma();
    repository = new SireMenuRepository(prisma);
  });

  describe('crearImportacion', () => {
    it('registers the import pending with the tenant and the message id', async () => {
      (prisma.sireImportacion.create as jest.Mock).mockResolvedValue({
        id: 'importacion-id',
        created_at: new Date('2026-01-05T10:00:00.000Z'),
      });

      await expect(
        repository.crearImportacion({
          companyId: COMPANY_ID,
          periodo: '202401',
          libro: 'RCE_COMPRAS',
          nombreArchivo: 'LE20601030013-RCE-202401.zip',
          messageId: 'message-id',
          rutaArchivo: 'sire/company-id/202401/archivo.zip',
          hashArchivo: 'hash',
          backendAlmacen: 'SUPABASE',
          bytes: 128,
        }),
      ).resolves.toEqual({
        id: 'importacion-id',
        created_at: new Date('2026-01-05T10:00:00.000Z'),
      });

      expect(prisma.sireImportacion.create).toHaveBeenCalledWith({
        data: {
          company_id: COMPANY_ID,
          periodo: '202401',
          libro: 'RCE_COMPRAS',
          nombre_archivo: 'LE20601030013-RCE-202401.zip',
          estado: 'PENDING',
          message_id: 'message-id',
          ruta_archivo: 'sire/company-id/202401/archivo.zip',
          hash_archivo: 'hash',
          backend_almacen: 'SUPABASE',
          total_registros: 0,
        },
        select: { id: true, created_at: true },
      });
    });
  });

  describe('estado de la importación', () => {
    it('completes an import that is pending or processing', async () => {
      await repository.completarImportacion('importacion-id', 42);

      expect(prisma.sireImportacion.updateMany).toHaveBeenCalledWith({
        where: { id: 'importacion-id', estado: { in: ['PENDING', 'PROCESSING'] } },
        data: {
          estado: 'COMPLETED',
          total_registros: 42,
          error_code: null,
          completed_at: expect.any(Date),
        },
      });
    });

    it('marks a pending import as processing', async () => {
      await repository.marcarImportacionEnProceso('importacion-id');

      expect(prisma.sireImportacion.updateMany).toHaveBeenCalledWith({
        where: { id: 'importacion-id', estado: 'PENDING' },
        data: { estado: 'PROCESSING' },
      });
    });

    it('fails an import that is not completed yet', async () => {
      await repository.fallarImportacion('importacion-id', 'QUEUE_ENQUEUE_FAILED');

      expect(prisma.sireImportacion.updateMany).toHaveBeenCalledWith({
        where: { id: 'importacion-id', estado: { not: 'COMPLETED' } },
        data: {
          estado: 'FAILED',
          error_code: 'QUEUE_ENQUEUE_FAILED',
          completed_at: expect.any(Date),
        },
      });
    });

    it('searches an import by message id and tenant', async () => {
      (prisma.sireImportacion.findFirst as jest.Mock).mockResolvedValue({
        id: 'importacion-id',
      });

      await expect(
        repository.buscarImportacionPorMessageId(COMPANY_ID, 'message-id'),
      ).resolves.toEqual({ id: 'importacion-id' });
      expect(prisma.sireImportacion.findFirst).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID, message_id: 'message-id' },
        select: expect.any(Object),
      });
    });
  });

  describe('listarImportaciones', () => {
    it('filters by tenant, period and book', async () => {
      (prisma.sireImportacion.findMany as jest.Mock).mockResolvedValue([]);

      await repository.listarImportaciones(COMPANY_ID, '202401', 'RCE_COMPRAS');

      expect(prisma.sireImportacion.findMany).toHaveBeenCalledWith({
        where: {
          company_id: COMPANY_ID,
          periodo: '202401',
          libro: 'RCE_COMPRAS',
        },
        orderBy: { created_at: 'desc' },
        select: expect.any(Object),
      });
    });

    it('omits the filters that were not sent', async () => {
      (prisma.sireImportacion.findMany as jest.Mock).mockResolvedValue([]);

      await repository.listarImportaciones(COMPANY_ID);

      expect(prisma.sireImportacion.findMany).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID },
        orderBy: { created_at: 'desc' },
        select: expect.any(Object),
      });
    });
  });

  describe('contadores', () => {
    it('counts the imports of the company and the period', async () => {
      (prisma.sireImportacion.count as jest.Mock).mockResolvedValue(3);
      (prisma.sireConciliacion.count as jest.Mock).mockResolvedValue(2);
      (prisma.sireReporte.count as jest.Mock).mockResolvedValue(1);

      await expect(
        repository.contarImportaciones(COMPANY_ID, '202401'),
      ).resolves.toBe(3);
      await expect(
        repository.contarConciliaciones(COMPANY_ID, '202401'),
      ).resolves.toBe(2);
      await expect(repository.contarReportes(COMPANY_ID)).resolves.toBe(1);

      expect(prisma.sireImportacion.count).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID, periodo: '202401' },
      });
      expect(prisma.sireConciliacion.count).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID, periodo: '202401' },
      });
      expect(prisma.sireReporte.count).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID },
      });
    });
  });

  describe('conciliaciones', () => {
    it('stores the reconciliation with its detail', async () => {
      (prisma.sireConciliacion.create as jest.Mock).mockResolvedValue({
        id: 'conciliacion-id',
        created_at: new Date('2026-01-06T10:00:00.000Z'),
      });

      await expect(
        repository.crearConciliacion({
          companyId: COMPANY_ID,
          periodo: '202401',
          conciliados: 7,
          diferencias: 1,
          detalle: { resumen: {}, comprobantes: [] },
        }),
      ).resolves.toEqual({
        id: 'conciliacion-id',
        created_at: new Date('2026-01-06T10:00:00.000Z'),
      });

      expect(prisma.sireConciliacion.create).toHaveBeenCalledWith({
        data: {
          company_id: COMPANY_ID,
          periodo: '202401',
          conciliados: 7,
          diferencias: 1,
          detalle: { resumen: {}, comprobantes: [] },
        },
        select: { id: true, created_at: true },
      });
    });
  });

  describe('reportes', () => {
    it('registers the report pending', async () => {
      (prisma.sireReporte.create as jest.Mock).mockResolvedValue({
        id: 'reporte-id',
        created_at: new Date('2026-01-07T10:00:00.000Z'),
      });

      await repository.crearReporte({
        companyId: COMPANY_ID,
        periodo: '202401',
        libro: 'RCE_COMPRAS',
        messageId: 'message-id',
        ticket: null,
      });

      expect(prisma.sireReporte.create).toHaveBeenCalledWith({
        data: {
          company_id: COMPANY_ID,
          periodo: '202401',
          libro: 'RCE_COMPRAS',
          estado: 'PENDING',
          message_id: 'message-id',
          ticket: null,
        },
        select: { id: true, created_at: true },
      });
    });

    it('changes the state of a report', async () => {
      await repository.marcarReporteEnProceso('reporte-id');
      await repository.completarReporte('reporte-id', '12345678');
      await repository.fallarReporte('reporte-id', 'SUNAT_HTTP_500');

      expect(prisma.sireReporte.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'reporte-id', estado: 'PENDING' },
        data: { estado: 'PROCESSING' },
      });
      expect(prisma.sireReporte.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'reporte-id', estado: { in: ['PENDING', 'PROCESSING'] } },
        data: {
          estado: 'COMPLETED',
          ticket: '12345678',
          error_code: null,
          completed_at: expect.any(Date),
        },
      });
      expect(prisma.sireReporte.updateMany).toHaveBeenNthCalledWith(3, {
        where: { id: 'reporte-id', estado: { not: 'COMPLETED' } },
        data: {
          estado: 'FAILED',
          error_code: 'SUNAT_HTTP_500',
          completed_at: expect.any(Date),
        },
      });
    });

    it('searches a report by message id and tenant', async () => {
      (prisma.sireReporte.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        repository.buscarReportePorMessageId(COMPANY_ID, 'message-id'),
      ).resolves.toBeNull();
      expect(prisma.sireReporte.findFirst).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID, message_id: 'message-id' },
        select: expect.any(Object),
      });
    });
  });

  describe('obtenerHistorial', () => {
    it('runs a single query that unions the three flows', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        {
          id: 'importacion-id',
          fecha: new Date('2026-01-05T10:00:00.000Z'),
          tipoAccion: 'IMPORTACION',
          periodo: '202401',
          estado: 'COMPLETED',
          detalle: 'LE1.zip',
        },
      ]);

      await expect(
        repository.obtenerHistorial(COMPANY_ID, '202401', 50),
      ).resolves.toHaveLength(1);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});

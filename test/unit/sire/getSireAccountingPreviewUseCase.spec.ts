import { NotFoundException } from '@nestjs/common';
import { GetSireAccountingPreviewUseCase } from '../../../src/modules/sire/application/use-cases/getSireAccountingPreviewUseCase';
import type { ISireAccountingPreviewRepositoryPort } from '../../../src/modules/sire/domain/ports/sireAccountingPreviewRepositoryPort';
import type { ISireAccountingMappingRepositoryPort } from '../../../src/modules/sire/domain/ports/sireAccountingMappingRepositoryPort';

describe('GetSireAccountingPreviewUseCase', () => {
  let totalsRepository: jest.Mocked<ISireAccountingPreviewRepositoryPort>;
  let mappingRepository: jest.Mocked<ISireAccountingMappingRepositoryPort>;
  let useCase: GetSireAccountingPreviewUseCase;

  beforeEach(() => {
    totalsRepository = {
      findPeriodTotals: jest.fn().mockResolvedValue([
        {
          bookType: 'RVIE_VENTAS',
          taxableBase: 1000,
          igvAmount: 180,
          totalAmount: 1180,
          comprobantes: 4,
        },
        {
          bookType: 'RCE_COMPRAS',
          taxableBase: 500,
          igvAmount: 90,
          totalAmount: 590,
          comprobantes: 2,
        },
      ]),
    };
    mappingRepository = {
      findAll: jest.fn().mockResolvedValue([
        { tipoOperacion: 'VENTAS', cuentaContable: '121' },
        { tipoOperacion: 'COMPRAS', cuentaContable: '421' },
        { tipoOperacion: 'BASE_VENTAS', cuentaContable: '701' },
        { tipoOperacion: 'BASE_COMPRAS', cuentaContable: '601' },
        { tipoOperacion: 'IGV', cuentaContable: '40111' },
      ]),
      upsertMany: jest.fn(),
    };
    useCase = new GetSireAccountingPreviewUseCase(
      totalsRepository,
      mappingRepository,
    );
  });

  it('devuelve la previsualización de ventas y compras del periodo', async () => {
    const result = await useCase.execute('company-1', '202602');

    expect(totalsRepository.findPeriodTotals).toHaveBeenCalledWith(
      'company-1',
      '202602',
    );
    expect(result.periodo).toBe('202602');
    expect(result.asientos).toHaveLength(2);
    expect(result.asientos[0]).toMatchObject({
      libro: 'RVIE_VENTAS',
      glosa: 'Asiento SIRE ventas 202602',
      fecha: '2026-02-28',
      totales: { base: 1000, igv: 180, total: 1180, comprobantes: 4 },
    });
    expect(result.asientos[0].lineas).toEqual([
      expect.objectContaining({ cuenta: '121', debe: 1180 }),
      expect.objectContaining({ cuenta: '701', haber: 1000 }),
      expect.objectContaining({ cuenta: '40111', haber: 180 }),
    ]);
    expect(result.asientos[1]).toMatchObject({
      libro: 'RCE_COMPRAS',
      glosa: 'Asiento SIRE compras 202602',
    });
    expect(result.asientos[1].lineas[0]).toMatchObject({
      cuenta: '601',
      debe: 500,
    });
  });

  it('filtra el libro solicitado', async () => {
    const result = await useCase.execute(
      'company-1',
      '202602',
      'RCE_COMPRAS',
    );

    expect(result.asientos).toHaveLength(1);
    expect(result.asientos[0].libro).toBe('RCE_COMPRAS');
  });

  it('rechaza empresas inexistentes', async () => {
    mappingRepository.findAll.mockResolvedValue(null);

    await expect(useCase.execute('missing', '202602')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza periodos sin importaciones', async () => {
    totalsRepository.findPeriodTotals.mockResolvedValue([]);

    await expect(
      useCase.execute('company-1', '202601'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza libros solicitados sin importaciones', async () => {
    totalsRepository.findPeriodTotals.mockResolvedValue([
      {
        bookType: 'RVIE_VENTAS',
        taxableBase: 100,
        igvAmount: 18,
        totalAmount: 118,
        comprobantes: 1,
      },
    ]);

    await expect(
      useCase.execute('company-1', '202602', 'RCE_COMPRAS'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('omite libros con importes en cero', async () => {
    totalsRepository.findPeriodTotals.mockResolvedValue([
      {
        bookType: 'RVIE_VENTAS',
        taxableBase: 0,
        igvAmount: 0,
        totalAmount: 0,
        comprobantes: 1,
      },
    ]);

    await expect(
      useCase.execute('company-1', '202602'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

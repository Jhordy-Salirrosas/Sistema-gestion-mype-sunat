import { ReopenAccountingPeriodUseCase } from '../../../src/modules/accounting/application/use-cases/reopenAccountingPeriodUseCase';
import { GetClosingPreviewUseCase } from '../../../src/modules/accounting/application/use-cases/getClosingPreviewUseCase';
import { GetAccountsWithMovementsUseCase } from '../../../src/modules/accounting/application/use-cases/getAccountsWithMovementsUseCase';

/**
 * Reapertura de períodos, vista previa del cierre y cuentas con movimientos.
 *
 * La reapertura es una operación auditada: sin motivo, con el año cerrado por
 * asiento de cierre o sobre un mes ya abierto, debe rechazarse.
 */
describe('ReopenAccountingPeriodUseCase', () => {
  const crear = (periodos: Array<{ period: string; status: string }>, tieneCierre = false) => ({
    findPeriods: jest.fn().mockResolvedValue(periodos),
    // El bloqueo mira solo cierres vigentes: uno anulado no debe impedir reabrir.
    tieneCierreAnualVigente: jest.fn().mockResolvedValue(tieneCierre),
    existsBySourceReference: jest.fn().mockResolvedValue(tieneCierre),
    openPeriod: jest.fn().mockResolvedValue({ period: '2026-11', status: 'ABIERTO' }),
    registrarReapertura: jest.fn().mockResolvedValue(undefined),
    anularAsientoCierre: jest.fn().mockResolvedValue(1),
  });

  it('reabre el período y registra el motivo', async () => {
    const repo = crear([{ period: '2026-11', status: 'CERRADO' }]);
    const caso = new ReopenAccountingPeriodUseCase(repo as never);

    const resultado = await caso.execute('c1', '2026-11', { motivo: 'Factura omitida del proveedor', usuarioId: 'u1' });

    expect(repo.openPeriod).toHaveBeenCalledWith('c1', 2026, 11);
    expect(repo.registrarReapertura).toHaveBeenCalledWith('c1', '2026-11', {
      motivo: 'Factura omitida del proveedor',
      usuarioId: 'u1',
    });
    expect(resultado.period.period).toBe('2026-11');
  });

  it('exige un motivo de al menos 10 caracteres', async () => {
    const repo = crear([{ period: '2026-11', status: 'CERRADO' }]);
    const caso = new ReopenAccountingPeriodUseCase(repo as never);

    await expect(caso.execute('c1', '2026-11', { motivo: 'corto' })).rejects.toThrow('al menos 10 caracteres');
    expect(repo.openPeriod).not.toHaveBeenCalled();
  });

  it('rechaza un período que no existe', async () => {
    const repo = crear([]);
    const caso = new ReopenAccountingPeriodUseCase(repo as never);

    await expect(caso.execute('c1', '2026-11', { motivo: 'Motivo suficientemente largo' })).rejects.toThrow('no existe');
  });

  it('rechaza un período que ya está abierto', async () => {
    const repo = crear([{ period: '2026-11', status: 'ABIERTO' }]);
    const caso = new ReopenAccountingPeriodUseCase(repo as never);

    await expect(caso.execute('c1', '2026-11', { motivo: 'Motivo suficientemente largo' })).rejects.toThrow('ya está abierto');
  });

  it('bloquea la reapertura si el ejercicio tiene asiento de cierre', async () => {
    const repo = crear([{ period: '2026-11', status: 'CERRADO' }], true);
    const caso = new ReopenAccountingPeriodUseCase(repo as never);

    await expect(caso.execute('c1', '2026-11', { motivo: 'Motivo suficientemente largo' })).rejects.toThrow(
      'asiento de cierre',
    );
  });

  it('anula el asiento de cierre cuando se pide explícitamente', async () => {
    const repo = crear([{ period: '2026-11', status: 'CERRADO' }], true);
    const caso = new ReopenAccountingPeriodUseCase(repo as never);

    await caso.execute('c1', '2026-11', {
      motivo: 'Ajuste por factura omitida',
      anularCierre: true,
    });

    expect(repo.anularAsientoCierre).toHaveBeenCalledWith('c1', 2026);
    expect(repo.openPeriod).toHaveBeenCalledWith('c1', 2026, 11);
  });

  it('no anula nada cuando no hay asiento de cierre', async () => {
    const repo = crear([{ period: '2026-11', status: 'CERRADO' }]);
    const caso = new ReopenAccountingPeriodUseCase(repo as never);

    await caso.execute('c1', '2026-11', { motivo: 'Motivo suficientemente largo' });

    expect(repo.anularAsientoCierre).not.toHaveBeenCalled();
  });

  it('pide marcar la anulación en lugar de rechazar sin salida', async () => {
    const repo = crear([{ period: '2026-11', status: 'CERRADO' }], true);
    const caso = new ReopenAccountingPeriodUseCase(repo as never);

    await expect(caso.execute('c1', '2026-11', { motivo: 'Motivo suficientemente largo' })).rejects.toThrow(
      'Marca "Anular el asiento de cierre"',
    );
  });

  it('avisa cuando hay períodos posteriores cerrados', async () => {
    const repo = crear([
      { period: '2026-11', status: 'CERRADO' },
      { period: '2026-12', status: 'CERRADO' },
    ]);
    const caso = new ReopenAccountingPeriodUseCase(repo as never);

    const resultado = await caso.execute('c1', '2026-11', { motivo: 'Motivo suficientemente largo' });

    expect(resultado.advertencias.join(' ')).toContain('1 período(s) posterior(es)');
  });
});

describe('GetClosingPreviewUseCase', () => {
  it('calcula ingresos, gastos y utilidad del ejercicio', async () => {
    const repo = {
      saldosDeResultado: jest.fn().mockResolvedValue([
        { code: '70121', name: 'Ventas', debit: 0, credit: 1180 },
        { code: '60111', name: 'Compras', debit: 600, credit: 0 },
      ]),
      existsBySourceReference: jest.fn().mockResolvedValue(false),
    };
    const caso = new GetClosingPreviewUseCase(repo as never);

    const resultado = await caso.execute('c1', 2026);

    expect(resultado.totalIngresos).toBe(1180);
    expect(resultado.totalGastos).toBe(600);
    expect(resultado.resultado).toBe(580);
    expect(resultado.tipo).toBe('UTILIDAD');
    expect(resultado.lineas).toHaveLength(2);
  });

  it('informa una pérdida cuando los gastos superan a los ingresos', async () => {
    const repo = {
      saldosDeResultado: jest.fn().mockResolvedValue([
        { code: '70121', name: 'Ventas', debit: 0, credit: 100 },
        { code: '60111', name: 'Compras', debit: 300, credit: 0 },
      ]),
      existsBySourceReference: jest.fn().mockResolvedValue(false),
    };
    const caso = new GetClosingPreviewUseCase(repo as never);

    const resultado = await caso.execute('c1', 2026);

    expect(resultado.resultado).toBe(-200);
    expect(resultado.tipo).toBe('PÉRDIDA');
  });

  it('marca que el asiento de cierre ya existe', async () => {
    const repo = {
      saldosDeResultado: jest.fn().mockResolvedValue([]),
      existsBySourceReference: jest.fn().mockResolvedValue(true),
    };
    const caso = new GetClosingPreviewUseCase(repo as never);

    const resultado = await caso.execute('c1', 2026);

    expect(resultado.tieneAsientoCierre).toBe(true);
    expect(resultado.tipo).toBe('SIN RESULTADO');
  });
});

describe('GetAccountsWithMovementsUseCase', () => {
  it('devuelve los códigos con movimientos del período', async () => {
    const repo = { findAccountCodesWithMovements: jest.fn().mockResolvedValue(['1011', '12121']) };
    const caso = new GetAccountsWithMovementsUseCase(repo as never);

    await expect(caso.execute('c1', '2026-11')).resolves.toEqual(['1011', '12121']);
    expect(repo.findAccountCodesWithMovements).toHaveBeenCalledWith('c1', '2026-11');
  });
});

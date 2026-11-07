import { parsearPadron } from '../../../src/modules/invoices/application/services/retentionPadronParser';

describe('padrón de agentes de retención', () => {
  it('parsea el CSV y normaliza la fecha', () => {
    const filas = parsearPadron('ruc,razon_social,valid_from\n20123456789,EMPRESA EJEMPLO S.A.C.,2026-01-01\n');
    expect(filas).toHaveLength(1);
    expect(filas[0].ruc).toBe('20123456789');
    expect(filas[0].validFrom.toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  it('rechaza un RUC inválido', () => {
    expect(() => parsearPadron('ruc,razon_social,valid_from\n123,EMPRESA,2026-01-01\n')).toThrow(/RUC inválido/);
  });
});

describe('padrón de agentes de retención · validaciones', () => {
  it('ignora comentarios y líneas vacías', () => {
    const filas = parsearPadron(
      'ruc,razon_social,valid_from\n# comentario\n\n20123456789,EMPRESA EJEMPLO S.A.C.,2026-01-01\n',
    );
    expect(filas).toHaveLength(1);
  });

  it('rechaza una fila sin razón social', () => {
    expect(() =>
      parsearPadron('ruc,razon_social,valid_from\n20123456789,,2026-01-01\n'),
    ).toThrow(/Falta razón social/);
  });

  it('rechaza una fecha inválida', () => {
    expect(() =>
      parsearPadron('ruc,razon_social,valid_from\n20123456789,EMPRESA,no-es-fecha\n'),
    ).toThrow(/Fecha inválida/);
  });
});

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LineaEmisionDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';

describe('M1 contrato del precio con IGV', () => {
  const linea = { descripcion: 'Producto', cantidad: 1, afectacion: '10' };
  it('acepta precio final sin exigir valor unitario sin IGV', async () => {
    expect(
      await validate(
        plainToInstance(LineaEmisionDto, { ...linea, precioUnitario: 118 }),
      ),
    ).toEqual([]);
  });
  it('sigue aceptando base sin IGV cuando no se envía precio final', async () => {
    expect(
      await validate(
        plainToInstance(LineaEmisionDto, { ...linea, valorUnitario: 100 }),
      ),
    ).toEqual([]);
  });
  it('exige alguno de los dos precios', async () => {
    const errors = await validate(plainToInstance(LineaEmisionDto, linea));
    expect(errors.map((e) => e.property)).toContain('valorUnitario');
  });
  it('valida la base explícita aunque también haya precio final', async () => {
    const errors = await validate(
      plainToInstance(LineaEmisionDto, {
        ...linea,
        precioUnitario: 118,
        valorUnitario: -1,
      }),
    );
    expect(
      errors.find((e) => e.property === 'valorUnitario')?.constraints,
    ).toHaveProperty('min');
  });
  it.each([-1, '118', 1.1234567])(
    'rechaza precio final inválido %s',
    async (precioUnitario) => {
      const errors = await validate(
        plainToInstance(LineaEmisionDto, { ...linea, precioUnitario }),
      );
      expect(errors.map((e) => e.property)).toContain('precioUnitario');
    },
  );
});

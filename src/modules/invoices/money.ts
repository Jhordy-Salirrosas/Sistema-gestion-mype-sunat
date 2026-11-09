import { Prisma } from '../../generated/client/client';

/** Política M1: decimal exacto, HALF_UP; importes a 2 y valores unitarios a 10 decimales. */
export const redondearMoneda = (n: number): number =>
  new Prisma.Decimal(n).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
export const multiplicarMoneda = (a: number, b: number): number =>
  new Prisma.Decimal(a).times(b).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
export const dividirMoneda = (a: number, b: number): number =>
  new Prisma.Decimal(a).div(b).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
export const dividirUnitario = (a: number, b: number): number =>
  new Prisma.Decimal(a).div(b).toDecimalPlaces(10, Prisma.Decimal.ROUND_HALF_UP).toNumber();
export const formatoUnitario = (n: number): string =>
  new Prisma.Decimal(n).toFixed(10, Prisma.Decimal.ROUND_HALF_UP).replace(/(\.\d{2}.*?)0+$/, '$1');
export const formatoMoneda = (n: number): string =>
  new Prisma.Decimal(n).toFixed(2, Prisma.Decimal.ROUND_HALF_UP);

import Decimal from 'decimal.js';
export function errorMontoDeposito(monto: number, tope: number): string | undefined {
  if (!Number.isFinite(monto) || monto <= 0 || new Decimal(monto).decimalPlaces() > 2 || monto > tope)
    return `El depósito debe ser positivo, tener como máximo 2 decimales y no superar ${tope.toFixed(2)}.`;
}

import { validateRucModulo11 } from '@/modules/auth/validators/rucValidator';

export const getPeriodFeedback = (period: string): string | null => {
  if (!period) return 'El período es obligatorio y debe tener formato YYYYMM.';
  if (!/^\d{6}$/.test(period)) return 'Use el formato YYYYMM, por ejemplo 202610.';
  const month = Number(period.slice(4));
  return month < 1 || month > 12 ? 'El mes debe estar entre 01 y 12.' : null;
};

export const getRucFeedback = (ruc: string): string | null => {
  if (!ruc) return 'Ingrese el RUC de 11 dígitos.';
  if (!/^\d{11}$/.test(ruc)) return 'El RUC debe contener 11 dígitos numéricos.';
  return validateRucModulo11(ruc) ? null : 'El RUC no supera la validación del dígito verificador Módulo 11.';
};

export const getAmountFeedback = (amount: string): string | null => {
  if (!amount || !Number.isFinite(Number(amount))) return 'Ingrese un importe numérico.';
  return /^\d+(?:\.\d{1,2})?$/.test(amount)
    ? null
    : 'El importe debe tener hasta 2 decimales.';
};

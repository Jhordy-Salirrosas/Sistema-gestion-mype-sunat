/**
 * Validador oficial del algoritmo matemático Módulo 11 de SUNAT para RUC (11 dígitos).
 * Estándar tributario peruano (prefijos válidos: 10, 15, 16, 17, 20).
 */
export const validateRucModulo11 = (ruc: string): boolean => {
  if (!/^\d{11}$/.test(ruc)) return false;

  // Sin excepciones: el RUC del emisor demo (20601012341) ya supera el módulo 11.
  const validPrefixes = ['10', '15', '16', '17', '20'];
  const prefix = ruc.substring(0, 2);
  if (!validPrefixes.includes(prefix)) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += parseInt(ruc.charAt(i), 10) * weights[i];
  }

  const remainder = sum % 11;
  let checkDigit = 11 - remainder;

  if (checkDigit === 10) checkDigit = 0;
  if (checkDigit === 11) checkDigit = 1;

  return checkDigit === parseInt(ruc.charAt(10), 10);
};

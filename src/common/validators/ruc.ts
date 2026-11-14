/**
 * Validación del RUC peruano (módulo 11).
 *
 * Vive en `common` y no en el módulo de facturación porque lo usan la emisión
 * (como decorador de DTO) y la exportación PLE (para comprobar que el RUC del
 * archivo es el mismo del comprobante). Duplicar la aritmética en dos sitios es
 * la forma más fácil de que una de las dos copias quede mal.
 */

/** Prefijos de RUC vigentes en SUNAT. */
const PREFIJOS_VALIDOS = ['10', '15', '16', '17', '20'];

/** Factores de ponderación del dígito verificador. */
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export const esRucValido = (ruc: unknown): boolean => {
  if (typeof ruc !== 'string' || !/^\d{11}$/.test(ruc)) return false;
  if (!PREFIJOS_VALIDOS.includes(ruc.slice(0, 2))) return false;

  let suma = 0;
  for (let i = 0; i < 10; i += 1) {
    suma += Number(ruc.charAt(i)) * PESOS[i];
  }
  let digito = 11 - (suma % 11);
  if (digito === 10) digito = 0;
  if (digito === 11) digito = 1;
  return digito === Number(ruc.charAt(10));
};

import { fechaIsoValida } from './invoiceFecha';

const diaCalendario = (fecha?: string | null): string | null => {
  const dia = typeof fecha === 'string' ? fecha.slice(0, 10) : '';
  return fechaIsoValida(dia) ? dia : null;
};

/**
 * Referencia de los Anexos 2 y 3 de la R.S. 183-2004/SUNAT: quinto día hábil
 * del mes siguiente. Por encargo se usa el mes de emisión como referencia,
 * pues el listado no contiene pago ni anotación en el Registro de Compras.
 * Cuenta lunes a viernes SIN descontar feriados; no determina el vencimiento
 * anterior que pueda corresponder por pago o por la anotación real.
 */
export function fechaLimiteDetraccion(emision: string): string | null {
  const dia = diaCalendario(emision);
  if (!dia) return null;
  const fecha = new Date(`${dia}T00:00:00Z`);
  fecha.setUTCDate(1);
  fecha.setUTCMonth(fecha.getUTCMonth() + 1);
  let habiles = 0;
  while (habiles < 5) {
    if (fecha.getUTCDay() !== 0 && fecha.getUTCDay() !== 6) habiles += 1;
    if (habiles < 5) fecha.setUTCDate(fecha.getUTCDate() + 1);
  }
  return fecha.toISOString().slice(0, 10);
}

/** Comparación estricta entre días calendario; el propio día límite está en plazo. */
export function superaPlazoDetraccion(fecha?: string | null, limite?: string | null): boolean {
  const dia = diaCalendario(fecha);
  const tope = diaCalendario(limite);
  return Boolean(dia && tope && dia > tope);
}

export function detraccionFueraDePlazo({ emision, pendiente, depositos, hoy }: {
  emision: string; pendiente: boolean; depositos: readonly string[]; hoy: string;
}): boolean {
  const limite = fechaLimiteDetraccion(emision);
  return (pendiente && superaPlazoDetraccion(hoy, limite)) || depositos.some(fecha => superaPlazoDetraccion(fecha, limite));
}

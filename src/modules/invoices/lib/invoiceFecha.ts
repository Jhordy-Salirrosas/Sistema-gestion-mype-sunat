/**
 * Utilidades de fecha del módulo de Facturación (M1).
 *
 * Vivían dentro de `InvoiceList.tsx`. Al retirar esa pantalla en TA-59 la
 * función se movió aquí, que es su sitio natural: es lógica de fecha, no de
 * presentación, y la usan tanto la grilla como las pruebas.
 */

/**
 * Fecha `YYYY-MM-DD` en la zona horaria del equipo, no en UTC.
 *
 * Un comprobante emitido a las 20:00 en Lima sigue siendo del mismo día
 * calendario; `toISOString()` lo habría fechado un día antes.
 */
export const fechaLocalIso = (d: Date): string => {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

/**
 * Desfase de Lima respecto de UTC, en milisegundos.
 *
 * El Perú no aplica horario de verano desde 1994, así que UTC-5 es constante y
 * no hace falta una base de zonas horarias. Se centraliza aquí para que las
 * cuatro pantallas del M1 que calculaban «hoy» con `Date.now() - 5h` a mano no
 * puedan desincronizarse entre sí.
 */
const DESFASE_LIMA_MS = 5 * 60 * 60 * 1000;

/**
 * Fecha de HOY en Lima (`YYYY-MM-DD`), para precargar la emisión (D9).
 *
 * Usa el reloj y por tanto es impura: hay que llamarla desde un inicializador
 * de `useState` o desde un manejador de eventos, nunca en el cuerpo del render
 * (la regla `react-hooks/purity` lo rechaza y además daría un valor distinto
 * cerca de medianoche).
 */
export const hoyEnLima = (): string =>
  new Date(Date.now() - DESFASE_LIMA_MS).toISOString().slice(0, 10);

/**
 * ¿Es una fecha `YYYY-MM-DD` que existe de verdad?
 *
 * `Date.parse('2026-02-30')` no da `NaN`: rueda al 2 de marzo. Comparar la
 * cadena de ida y vuelta es lo único que distingue una fecha real de una
 * imposible, y el usuario puede escribir el mes o el día a mano.
 */
export const fechaIsoValida = (fecha: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
};

/** Días calendario entre dos fechas `YYYY-MM-DD`; `null` si alguna no existe. */
export const diasEntreFechas = (
  desde: string,
  hasta: string,
): number | null => {
  if (!fechaIsoValida(desde) || !fechaIsoValida(hasta)) return null;
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
};

/**
 * Días que se pueden retroceder respecto de hoy al fechar un comprobante.
 *
 * NO es un capricho: es el plazo de la regla 2957. Una boleta informada por
 * resumen diario se rechaza si su fecha de emisión quedó a más de 7 días de la
 * fecha del resumen, y el resumen se arma con la fecha pedida al backend. Fechar
 * hacia atrás más de una semana produce documentos que nacen caducados, así que
 * el formulario no lo ofrece.
 */
export const DIAS_MAXIMOS_ATRASO = 7;

/**
 * Período contable en curso en Lima: año, mes (1-12) y la clave `YYYY-MM`.
 *
 * Lo usaba el módulo de contabilidad calculándolo con su propio `-5h`. Un
 * período y una fecha no son lo mismo (el período es un mes, la fecha es un
 * día), así que se expone aparte en vez de recortar `hoyEnLima()`.
 */
export const periodoActualLima = (): {
  anio: number;
  mes: number;
  clave: string;
} => {
  const lima = new Date(Date.now() - DESFASE_LIMA_MS);
  const anio = lima.getUTCFullYear();
  const mes = lima.getUTCMonth() + 1;
  return { anio, mes, clave: `${anio}-${String(mes).padStart(2, '0')}` };
};

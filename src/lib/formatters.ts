/**
 * Utilidades de formateo numérico, monetario y de fechas
 * adaptadas a la normativa comercial y contable peruana (SUNAT).
 */

/**
 * Formatea un valor numérico a moneda peruana (PEN - Soles) o dólares (USD).
 * Ej: formatCurrency(1250.5, 'PEN') -> "S/ 1,250.50"
 */
export const formatCurrency = (
  amount: number,
  currency: 'PEN' | 'USD' = 'PEN'
): string => {
  const symbol = currency === 'PEN' ? 'S/ ' : '$ ';
  const formatted = new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${symbol}${formatted}`;
};

/**
 * Convierte una fecha ISO (ej. "2026-10-14T18:00:00Z") al formato estándar peruano DD/MM/YYYY.
 *
 * Una fecha sin hora ("2026-10-23") representa un día calendario, no un
 * instante: `new Date("2026-10-23")` la interpreta como medianoche UTC y al
 * mostrarla en Lima (UTC-5) retrocedía al día anterior. Por eso la fecha pura
 * se formatea sin pasar por la zona horaria.
 */
export const formatDateToPeru = (isoDateString: string | Date | null | undefined): string => {
  if (!isoDateString) return '-';

  if (typeof isoDateString === 'string') {
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDateString.trim());
    if (soloFecha) {
      const [, anio, mes, dia] = soloFecha;
      return `${dia}/${mes}/${anio}`;
    }
  }

  const date = typeof isoDateString === 'string' ? new Date(isoDateString) : isoDateString;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

/**
 * Formatea fecha y hora completa en formato DD/MM/YYYY HH:mm:ss.
 */
export const formatDateTimeToPeru = (isoDateString: string | Date | null | undefined): string => {
  if (!isoDateString) return '-';
  const date = typeof isoDateString === 'string' ? new Date(isoDateString) : isoDateString;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
};

/**
 * Validador sintáctico simple para número de RUC peruano (11 dígitos, inicia con 10, 15, 17 o 20).
 */
export const isValidRuc = (ruc: string): boolean => {
  const rucRegex = /^(10|15|17|20)\d{9}$/;
  return rucRegex.test(ruc.trim());
};

/**
 * Validador para DNI peruano (8 dígitos numéricos).
 */
export const isValidDni = (dni: string): boolean => {
  return /^\d{8}$/.test(dni.trim());
};

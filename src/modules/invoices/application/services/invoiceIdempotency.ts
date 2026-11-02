/**
 * Idempotencia del envío (TA-32) — Frente 3: la clave del cliente.
 *
 * El criterio 3 del backlog pide que un doble clic en la UI dentro de la
 * ventana de 2 s no cree un segundo comprobante. El frente 1 (índice único
 * `uq_invoices_idempotencia`) y el frente 2 (conciliación previa con
 * billConsultService, ver `conciliarAntesDeReintentar`) resuelven el problema
 * en la base de datos y en la red; este archivo resuelve el caso que ocurre
 * ANTES de llegar a la base: dos peticiones idénticas en vuelo.
 *
 * Decisión de diseño: la clave se DERIVA del contenido fiscal del comprobante
 * y no se confía en un encabezado del cliente. Si dependiera de un
 * `Idempotency-Key` que manda el navegador, un doble clic seguiría generando
 * dos claves distintas y el criterio no se cumpliría; derivarla garantiza que
 * dos envíos del mismo comprobante produzcan SIEMPRE la misma clave.
 *
 * La huella es determinista y estable entre despliegues: sha256 de los campos
 * normalizados, sin fecha, sin aleatoriedad y sin estado en memoria.
 */
import { createHash } from 'node:crypto';

/** Campos que definen la identidad fiscal de un comprobante. */
export interface ClaveIdempotenciaCampos {
  companyId: string;
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
}

/**
 * Normaliza cada componente antes de hashear.
 *
 * La serie y el tipo son los únicos que el usuario escribe a mano, así que en
 * la clave se pasan a mayúsculas y se recortan: `f001` y `F001` son el mismo
 * comprobante para SUNAT y no deben producir dos claves distintas.
 *
 * El RUC NO se normaliza más allá del recorte: un RUC con espacios ya lo
 * rechaza el decorador `@IsRucValid`, y "corregirlo" aquí escondería un dato
 * inválido.
 */
function normalizar(campos: ClaveIdempotenciaCampos) {
  return [
    campos.companyId.trim(),
    campos.rucEmisor.trim(),
    campos.tipoComprobante.trim().padStart(2, '0'),
    campos.serie.trim().toUpperCase(),
    String(campos.correlativo).trim(),
  ].join('|');
}

/**
 * Clave de idempotencia derivada (64 caracteres hex).
 *
 * Es la misma para dos peticiones con el mismo comprobante aunque lleguen de
 * procesos distintos, y distinta si cambia cualquiera de los cinco campos.
 */
export function construirClaveIdempotencia(
  campos: ClaveIdempotenciaCampos,
): string {
  return createHash('sha256').update(normalizar(campos), 'utf8').digest('hex');
}

/**
 * Registro de peticiones en vuelo.
 *
 * Guarda la promesa de la primera petición para que las siguientes con la
 * misma clave ESPEREN ese resultado en lugar de ejecutar el trabajo otra vez.
 * Es un `Map` en memoria: protege un solo proceso, que es lo que hace falta
 * para el doble clic. Entre instancias distintas la garantía la da el índice
 * único de la base (frente 1), que es la fuente de verdad.
 */
export class RegistroEnVuelo<T> {
  private readonly enVuelo = new Map<string, Promise<T>>();

  /** Cantidad de claves actualmente en proceso (para métricas y pruebas). */
  get tamano(): number {
    return this.enVuelo.size;
  }

  /**
   * Ejecuta `trabajo` una sola vez por clave.
   *
   * Si ya hay una ejecución en vuelo para esa clave se devuelve la MISMA
   * promesa: ambos llamadores reciben el mismo resultado (criterio 2: el
   * segundo POST responde 200 con el registro existente, no crea otro).
   * La entrada se borra al terminar, con éxito o con error, para no dejar
   * claves obsoletas que bloqueen un reintento legítimo más adelante.
   */
  async ejecutar(clave: string, trabajo: () => Promise<T>): Promise<T> {
    const existente = this.enVuelo.get(clave);
    if (existente) return existente;

    const promesa = trabajo();
    this.enVuelo.set(clave, promesa);

    try {
      return await promesa;
    } finally {
      this.enVuelo.delete(clave);
    }
  }
}

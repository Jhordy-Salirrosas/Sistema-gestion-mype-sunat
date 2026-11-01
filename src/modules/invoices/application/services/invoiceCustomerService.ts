/**
 * Búsqueda de clientes por documento o razón social (TA-61).
 *
 * POR QUÉ NO HAY UNA TABLA DE CLIENTES
 *
 * El sistema no tiene una entidad "Cliente": el adquirente se guarda en cada
 * comprobante (`customer_identity_type`, `customer_identity_number`,
 * `customer_legal_name`). Crear un maestro de clientes habría exigido una
 * migración que ningún requisito del M1 pide.
 *
 * La cartera se deriva entonces de los comprobantes ya emitidos: es la lista de
 * a quién le facturó la empresa, que es exactamente lo que el usuario espera
 * encontrar al volver a facturarle. Cada cliente aparece una vez, con los datos
 * de su emisión más reciente, porque si el RUC se corrigió la búsqueda debe
 * ofrecer el vigente y no el viejo.
 *
 * POR QUÉ SE FILTRA EN MEMORIA Y NO CON `LIKE`
 *
 * El filtrado tiene que ignorar tildes ("PEREZ" encuentra "PÉREZ") y eso en
 * PostgreSQL depende de una extensión (`unaccent`) que no está declarada en el
 * esquema. Traer los clientes distintos de la empresa y filtrar en Node da el
 * mismo resultado sin tocar la base, y el volumen es pequeño: los clientes
 * distintos de una MYPE, no sus comprobantes.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

/** Mínimo de caracteres para buscar por razón social. */
export const MINIMO_CARACTERES = 2;

/** Máximo de resultados que devuelve el buscador. */
export const LIMITE_RESULTADOS = 10;

/** Cliente tal como lo devuelve el buscador. */
export interface ClienteEncontrado {
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
}

/** Quita tildes y pasa a minúsculas para comparar. */
export const normalizar = (texto: string): string =>
  (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/**
 * Filtra la cartera por lo escrito.
 *
 * Función pura para poder probar los bordes sin base de datos: qué ocurre con
 * una sola letra, con un documento parcial, con tildes y con un texto vacío.
 */
export const filtrarCartera = (
  cartera: readonly ClienteEncontrado[],
  texto: string,
  limite = LIMITE_RESULTADOS,
): readonly ClienteEncontrado[] => {
  const limpio = (texto ?? '').trim();
  if (limpio.length === 0) return [];

  const soloDigitos = /^\d+$/.test(limpio);

  if (soloDigitos) {
    // Un número se busca por documento y no por nombre: quien teclea "2010"
    // espera el RUC que empieza así.
    const buscado = limpio.replace(/\D/g, '');
    return cartera
      .filter((c) => c.numeroDocumento.replace(/\D/g, '').startsWith(buscado))
      .slice(0, limite);
  }

  if (limpio.length < MINIMO_CARACTERES) return [];

  const buscado = normalizar(limpio);
  return cartera
    .filter((c) => normalizar(c.razonSocial).includes(buscado))
    .slice(0, limite);
};

@Injectable()
export class InvoiceCustomerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Clientes distintos que la empresa ya usó, del más reciente al más antiguo.
   *
   * Se pide `orderBy` descendente y se deduplica quedándose con la primera
   * aparición: así, si el mismo RUC se emitió con dos razones sociales
   * distintas, gana la última, que es la que el usuario escribió bien.
   */
  public async cartera(companyId: string): Promise<ClienteEncontrado[]> {
    const filas = await this.prisma.invoice.findMany({
      where: {
        company_id: companyId,
        customer_identity_number: { not: null },
      },
      select: {
        customer_identity_type: true,
        customer_identity_number: true,
        customer_legal_name: true,
      },
      orderBy: { created_at: 'desc' },
      // Una empresa con muchos comprobantes no necesita traerlos todos para
      // sacar la lista de clientes distintos.
      take: 2000,
    });

    const vistos = new Map<string, ClienteEncontrado>();
    for (const fila of filas) {
      const numero = (fila.customer_identity_number ?? '').trim();
      if (!numero || vistos.has(numero)) continue;

      vistos.set(numero, {
        tipoDocumento: (fila.customer_identity_type ?? '6').trim(),
        numeroDocumento: numero,
        razonSocial: (fila.customer_legal_name ?? '').trim(),
      });
    }

    return [...vistos.values()];
  }

  /** Busca clientes por documento o razón social. */
  public async buscar(
    companyId: string,
    texto: string,
  ): Promise<ClienteEncontrado[]> {
    const cartera = await this.cartera(companyId);
    return [...filtrarCartera(cartera, texto)];
  }
}

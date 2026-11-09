/**
 * Vista previa de resúmenes diarios (RC) y comunicaciones de baja (RA) — M1.
 *
 * POR QUÉ EXISTE
 *
 * El apartado "Bajas y Resúmenes Diarios" del menú mostraba la misma grilla de
 * comprobantes que "Facturas y Boletas": solo cambiaba el título. Un resumen y
 * una baja no son comprobantes sueltos — son ENVÍOS agregados con su propio
 * identificador (RC-AAAAMMDD-NNN / RA-AAAAMMDD-NNN) y su propio ticket de SUNAT.
 *
 * Esta pieza responde a la pregunta que el docente hizo en la revisión:
 *
 *   "No sé qué se refieren con el caso de las bajas. ¿Se refieren a que ha sido
 *    anulado el comprobante de pago?"
 *
 * Sí: una baja (RA) es la ANULACIÓN de un comprobante ya aceptado. Y el resumen
 * (RC) es el envío agrupado de las boletas del día.
 *
 * QUÉ NO HACE
 *
 * No envía a SUNAT. Construye y valida el XML con las reglas que el backend ya
 * tiene (`summaryDocumentsBuilder`), para que el usuario vea qué se enviaría
 * antes de gastar un ticket. El envío real sigue en la cola de resúmenes.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { Prisma } from '../../../../generated/client/client';
import { fiscalResumen } from './summaryFiscal';
import type { SeleccionBaja } from './summaryAggregateStore';
import {
  construirComunicacionBaja,
  construirResumenDiario,
  diasDesdeEmision,
  DIAS_MAXIMOS_RESUMEN,
  ESTADOS_YA_INFORMADOS,
  motivoYaInformado,
  TIPOS_EN_BAJA,
  vaEnResumen,
  type CabeceraResumen,
  type ComprobanteAgregado,
} from '../../application/services/summaryDocumentsBuilder';

/** Correlativo del envío, tal como lo lleva el identificador RC/RA. */
export interface EnvioAgregado {
  /** RC-AAAAMMDD-NNN o RA-AAAAMMDD-NNN. */
  identificador: string;
  tipo: 'RESUMEN_DIARIO' | 'COMUNICACION_BAJA';
  /** Fecha de referencia, YYYY-MM-DD. */
  fechaReferencia: string;
  correlativo: number;
  /** Cuántos comprobantes lleva. */
  lineas: number;
}

/** Detalle de un comprobante dentro de la vista previa. */
/** Estados en los que el comprobante nunca llegó a SUNAT y admite reenvío. */
export const ESTADOS_REENVIABLES_SUNAT = ['PENDIENTE', 'EN_COLA', 'ERROR_RED'] as const;

export interface LineaVista {
  id: string;
  serie: string;
  correlativo: number;
  tipoComprobante: string;
  fechaEmision: string;
  estado: string;
  /** `true` cuando el comprobante nunca llegó a SUNAT y puede reenviarse desde la fila. */
  reenviable: boolean;
  total: number;
  incluido: boolean;
  /** Motivo por el que no entra, cuando no entra. */
  motivoExclusion: string;
  /** Días transcurridos desde la emisión (regla 2957). */
  dias: number | null;
}

/** Resultado de la vista previa. */
export interface VistaPrevia {
  envio: EnvioAgregado;
  lineas: readonly LineaVista[];
  /** XML que se enviaría. `null` si no hay nada que informar. */
  xml: string | null;
  /** Errores de regla que impiden el envío. */
  errores: readonly string[];
}

/** Redondeo a céntimos. */
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Fecha ISO corta (YYYY-MM-DD). */
const fechaCorta = (d: Date): string => d.toISOString().slice(0, 10);

@Injectable()
export class InvoiceSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Boletas del día que entrarían en el resumen.
   *
   * Se listan TODAS las del día, incluidas las que se excluyen, con su motivo:
   * esconderlas haría que el usuario contara mal y no entendiera por qué el
   * resumen lleva menos líneas de las que emitió.
   */
  public async vistaResumenDiario(
    companyId: string,
    fecha: string,
    correlativo = 1,
    seleccion?: SeleccionBaja[],
    transaction?: Prisma.TransactionClient,
    excludeAggregateId?: string,
  ): Promise<VistaPrevia> {
    const desde = new Date(`${fecha}T00:00:00.000Z`);
    const hasta = new Date(`${fecha}T23:59:59.999Z`);

    const db = transaction ?? this.prisma;
    const filas = await db.invoice.findMany({
      where: {
        company_id: companyId,
        fecha_emision: { gte: desde, lte: hasta },
        // Un resumen diario agrupa SOLO boletas (03) y sus notas, que llevan
        // serie que empieza por B (BC01, BD01...). Antes se traían todas las
        // notas 07/08, incluidas las de factura (FC01/FD01), y entonces el
        // generador abortaba con "FC01-3 no pertenece a un resumen diario":
        // una sola nota de crédito a factura del día impedía enviar el resumen
        // de las boletas. Las notas con serie F se van por sendBill o por RA.
        OR: [
          { tipo_comprobante: '03' },
          { tipo_comprobante: { in: ['07', '08'] }, serie: { startsWith: 'B' } },
        ],
      },
      orderBy: [{ serie: 'asc' }, { correlativo: 'asc' }],
    });

    const cabecera = await this.cabecera(companyId, fecha, correlativo, 'RC', db);
    const reservas = await db.invoiceAggregate?.findMany({ where: { company_id: companyId, state: { notIn: ['BLOCKED', 'REJECTED'] }, ...(excludeAggregateId ? { id: { not: excludeAggregateId } } : {}) }, select: { members: true } }) ?? [];
    const reservados = new Set(reservas.flatMap(r => (r.members as unknown as { id: string }[]).map(m => m.id)));
    const fiscal = new Map<string, ComprobanteAgregado>();
    const agregados = filas.map(f => {
      const l = this.aAgregado(f, fecha);
      const days = diasDesdeEmision(fechaCorta(f.fecha_emision), cabecera.fechaGeneracion);
      let motivo = l.motivoExclusion;
      if (!motivo && (f.estado !== 'PENDIENTE' || f.transport_uncertain !== false)) motivo = 'Despacho individual en curso o transporte no confirmado como seguro.';
      if (!motivo && reservados.has(f.id)) motivo = 'Ya reservado en un agregado.';
      if (!motivo && f.ruc_emisor !== cabecera.rucEmisor) motivo = 'RUC histórico distinto al emisor efectivo.';
      if (!motivo && (days === null || days < 0 || days > 7)) motivo = 'Fuera del plazo respecto de la fecha de generación.';
      if (!motivo && seleccion && !seleccion.some(m => m.id === f.id)) motivo = 'No seleccionado en la reserva.';
      if (!motivo) {
        try { fiscal.set(f.id, { ...this.aComprobante(f), documentoAfectado: f.referenced_series_correlative ?? undefined, fiscal: fiscalResumen(f.payload_ubl, Number(f.monto_total)) }); }
        catch (error) { motivo = this.mensajeDe(error); }
      }
      return { ...l, incluido: !motivo, motivoExclusion: motivo, reenviable: false };
    });
    const errores: string[] = [];
    const incluidos = agregados.filter(l => l.incluido);
    if (seleccion && incluidos.length !== seleccion.length) errores.push('Los miembros reservados ya no son elegibles para RC');
    let xml: string | null = null;

    if (incluidos.length > 0) {
      try {
        xml = construirResumenDiario(
          cabecera,
          incluidos.map(l => fiscal.get(l.id)!),
        );
      } catch (error: unknown) {
        errores.push(this.mensajeDe(error));
      }
    }

    return {
      envio: {
        // El identificador de la TARJETA debe ser el mismo que el `<cbc:ID>` del
        // XML. Antes se armaba con la fecha de REFERENCIA (`fecha`, el día de
        // los comprobantes) mientras el constructor usaba la de GENERACIÓN, así
        // que la pantalla decía `RC-20261101-001` y el XML del mismo payload
        // decía `RC-20261102-001`. Dos identificadores para un solo documento:
        // quien recibiera el ZIP buscaría un archivo que no cuadra con lo que
        // vio en pantalla.
        //
        // Se usa `cabecera.fechaGeneracion` (regla 2346) y la fecha de
        // referencia viaja aparte en `fechaReferencia`.
        identificador: `RC-${cabecera.fechaGeneracion.replace(/-/g, '')}-${String(correlativo).padStart(3, '0')}`,
        tipo: 'RESUMEN_DIARIO',
        fechaReferencia: fecha,
        correlativo,
        lineas: incluidos.length,
      },
      lineas: agregados,
      xml,
      errores,
    };
  }

  /**
   * Comprobantes candidatos a baja.
   *
   * Solo lo ACEPTADO u OBSERVADO puede darse de baja: dar de baja algo que SUNAT
   * todavía no procesó es un rechazo seguro.
   */
  public async vistaComunicacionBaja(
    companyId: string,
    fecha: string,
    correlativo = 1,
    seleccion?: SeleccionBaja[],
    transaction?: Prisma.TransactionClient,
    excludeAggregateId?: string,
  ): Promise<VistaPrevia> {
    const desde = new Date(`${fecha}T00:00:00.000Z`);
    const hasta = new Date(`${fecha}T23:59:59.999Z`);

    const db = transaction ?? this.prisma;
    const filas = await db.invoice.findMany({
      where: {
        company_id: companyId,
        fecha_emision: { gte: desde, lte: hasta },
        tipo_comprobante: { in: ['01', '07', '08'] },
      },
      orderBy: [{ serie: 'asc' }, { correlativo: 'asc' }],
    });

    const cabecera = await this.cabecera(companyId, fecha, correlativo, 'RA', db);
    const notas = await db.invoice.findMany({ where: { company_id: companyId, tipo_comprobante: '07', referenced_invoice_id: { in: filas.map(f => f.id) }, estado: { notIn: ['RECHAZADO', 'ANULADO'] } }, select: { referenced_invoice_id: true, estado: true, monto_total: true } });
    const reservas = await db.invoiceAggregate?.findMany({ where: { company_id: companyId, state: { notIn: ['BLOCKED', 'REJECTED'] }, ...(excludeAggregateId ? { id: { not: excludeAggregateId } } : {}) }, select: { members: true } }) ?? [];
    const reservados = new Set(reservas.flatMap(r => (r.members as unknown as { id: string }[]).map(m => m.id)));
    const agregados = filas.map((f) => {
      const linea = this.aAgregado(f, fecha);
      const creditos = notas.filter(n => n.referenced_invoice_id && n.referenced_invoice_id === f.id);
      const neutralizado = Number(f.monto_total) > 0 && creditos.filter(n => ['ACEPTADO', 'OBSERVADO'].includes(n.estado)).reduce((sum, n) => sum + Math.round(Number(n.monto_total) * 100), 0) >= Math.round(Number(f.monto_total) * 100);
      const pendiente = creditos.some(n => !['ACEPTADO', 'OBSERVADO'].includes(n.estado));
      const diasHastaHoy = diasDesdeEmision(fechaCorta(f.fecha_emision), cabecera.fechaGeneracion);
      const motivo = f.ruc_emisor && f.ruc_emisor !== cabecera.rucEmisor ? 'RUC histórico distinto al emisor efectivo.' : diasHastaHoy !== null && (diasHastaHoy < 0 || diasHastaHoy > 7) ? 'Fuera del plazo de 7 días respecto de la generación.' : neutralizado ? 'Neutralizado por nota de crédito de saldo completo.' : pendiente ? 'Nota de crédito en proceso.' : reservados.has(f.id) ? 'Ya reservado en un agregado.' : !['ACEPTADO', 'OBSERVADO'].includes(f.estado) ? `Estado ${f.estado}: solo aceptados u observados admiten baja.` : '';
      const admiteBaja = !motivo && (!seleccion || seleccion.some(l => l.id === f.id));
      return {
        ...linea,
        incluido: admiteBaja,
        motivoExclusion: motivo || (admiteBaja ? '' : 'No seleccionado.'),
      };
    });

    // Regla 2308: una boleta no se anula por RA, se resta en un resumen.
    const errores: string[] = [];
    const incluidos = agregados.filter((l) => l.incluido);
    let xml: string | null = null;

    // La cabecera se construye SIEMPRE, no solo cuando hay algo que informar:
    // su `fechaGeneracion` es la que da nombre al identificador, y la tarjeta
    // tiene que mostrar el mismo que el XML aunque la lista venga vacía.
    if (incluidos.length > 0) {
      try {
        xml = construirComunicacionBaja(
          cabecera,
          filas.filter((_, i) => agregados[i].incluido).map((f) => ({ ...this.aComprobante(f), motivoBaja: seleccion?.find(l => l.id === f.id)?.motivo ?? 'Anulación de la operación' })),
        );
      } catch (error: unknown) {
        errores.push(this.mensajeDe(error));
      }
    }

    return {
      envio: {
        // Misma regla que el resumen diario: el identificador de la tarjeta es
        // el del XML (fecha de GENERACIÓN, regla 2346), no el de la fecha de
        // referencia de los comprobantes dados de baja.
        identificador: `RA-${cabecera.fechaGeneracion.replace(/-/g, '')}-${String(correlativo).padStart(3, '0')}`,
        tipo: 'COMUNICACION_BAJA',
        fechaReferencia: fecha,
        correlativo,
        lineas: incluidos.length,
      },
      lineas: agregados,
      xml,
      errores,
    };
  }

  /** Convierte una fila de la base a la vista con su motivo de exclusión. */
  private aAgregado(
    fila: {
      id?: string;
      serie: string;
      correlativo: number;
      tipo_comprobante: string;
      fecha_emision: Date;
      estado: string;
      monto_total: unknown;
      customer_identity_type: string | null;
      customer_identity_number: string | null;
      total_igv: unknown;
    },
    fechaReferencia: string,
  ): LineaVista {
    const fechaEmision = fechaCorta(fila.fecha_emision);
    const dias = diasDesdeEmision(fechaEmision, fechaReferencia);

    const comprobante: ComprobanteAgregado = this.aComprobante(fila);

    let motivoExclusion = '';
    if (comprobante.estado === 'RECHAZADO') {
      motivoExclusion = 'Rechazado por SUNAT: no existe ante la administración.';
    } else if (comprobante.estado === 'ANULADO') {
      motivoExclusion = 'Ya anulado: volver a informarlo lo resucitaría.';
    } else if (ESTADOS_YA_INFORMADOS.includes(comprobante.estado)) {
      // D11: ya tiene CDR de SUNAT. La línea SIGUE VISIBLE, marcada como
      // excluida y con su motivo, para que el usuario entienda por qué no se
      // informa en vez de notar que «faltan boletas».
      motivoExclusion = motivoYaInformado(comprobante);
    } else if (dias !== null && dias > DIAS_MAXIMOS_RESUMEN) {
      motivoExclusion = `Fuera del plazo de ${DIAS_MAXIMOS_RESUMEN} días (regla 2957).`;
    }

    return {
      id: fila.id ?? `${fila.serie}-${fila.correlativo}`,
      serie: fila.serie,
      correlativo: fila.correlativo,
      tipoComprobante: fila.tipo_comprobante,
      fechaEmision,
      estado: fila.estado,
      reenviable: (ESTADOS_REENVIABLES_SUNAT as readonly string[]).includes(fila.estado),
      total: r2(Number(fila.monto_total ?? 0)),
      incluido: motivoExclusion === '',
      motivoExclusion,
      dias,
    };
  }

  /** Fila de Prisma al comprobante que espera el constructor de XML. */
  private aComprobante(fila: {
    serie: string;
    correlativo: number;
    tipo_comprobante: string;
    fecha_emision: Date;
    estado: string;
    monto_total: unknown;
    customer_identity_type: string | null;
    customer_identity_number: string | null;
    total_igv: unknown;
  }): ComprobanteAgregado {
    return {
      tipoComprobante: fila.tipo_comprobante,
      serie: fila.serie,
      correlativo: fila.correlativo,
      fechaEmision: fechaCorta(fila.fecha_emision),
      estado: fila.estado,
      total: r2(Number(fila.monto_total ?? 0)),
      igv: r2(Number(fila.total_igv ?? 0)),
      tipoDocCliente: fila.customer_identity_type ?? '0',
      numDocCliente: fila.customer_identity_number ?? '-',
    };
  }

  /** Cabecera del envío, con el RUC de la empresa. */
  private async cabecera(
    companyId: string,
    fechaReferencia: string,
    correlativo: number,
    _prefijo: 'RC' | 'RA',
    db: Pick<PrismaService, 'company'> = this.prisma,
  ): Promise<CabeceraResumen> {
    const empresa = await db.company.findUnique({
      where: { id: companyId },
      select: { ruc: true, legal_name: true },
    });

    if (!empresa) {
      throw new NotFoundException('La empresa del usuario no existe.');
    }

    return {
      rucEmisor: empresa.ruc,
      razonSocialEmisor: empresa.legal_name,
      correlativo,
      fechaResumen: fechaReferencia,
      fechaGeneracion: new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10),
    };
  }

  /** Mensaje legible de un rechazo del constructor de XML. */
  private mensajeDe(error: unknown): string {
    if (error && typeof error === 'object' && 'getResponse' in error) {
      const respuesta = (error as { getResponse: () => unknown }).getResponse();
      if (respuesta && typeof respuesta === 'object' && 'message' in respuesta) {
        return String((respuesta as { message: unknown }).message);
      }
    }
    return error instanceof Error ? error.message : 'Error desconocido.';
  }
}

/** Reexporta lo que la vista necesita de las reglas. */
export { TIPOS_EN_BAJA, vaEnResumen };

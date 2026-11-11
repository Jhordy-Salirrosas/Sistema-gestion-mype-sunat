import type { CantidadNota } from '../lib/invoiceNoteQuantities';
import type { SeleccionBaja, AgregadoFiscal } from '../types/invoiceAggregate.types';
import { apiClient } from '@/lib/axios';
import { cachedGet } from '@/lib/offlineCache';
import { type Invoice } from '../types/invoice.types';
import { type CreateInvoiceDto } from '../types/invoice.types';
import {
  aCreateInvoiceDto,
  aInvoice,
  aInvoiceDetalle,
  aPaginaInvoices,
  type ComprobanteBackend,
  type ComprobanteDetalleBackend,
  type PaginaBackend,
} from '../lib/invoiceMapper';
import {
  normalizarMetricas,
  type MetricasFacturacion,
} from '../lib/invoiceMetricsPeriodo';
import {
  normalizarAlertas,
  type AlertasOperativas,
} from '../lib/invoiceAlertas';
import type { ClienteBuscado } from '../lib/invoiceSearch';
import type { VistaPreviaResumen } from '../lib/invoiceResumenes';
import type { ResultadoEnvioAgregado } from '../types/invoiceEnvioAgregado.types';
import type {
  EmitirComprobantePayload,
  ResultadoEmisionBackend,
} from '../types/invoiceEmision.types';

/** Filtros que acepta el listado del backend (TA-29). */
export interface ListadoParams {
  estado?: string;
  tipo?: string;
  serie?: string;
  desde?: string;
  hasta?: string;
  page_size?: number;
}

/** Filtros que acepta el listado (el backend ya los soporta). */
export interface FiltrosInvoices {
  estado?: string;
  tipo?: string;
  serie?: string;
  desde?: string;
  hasta?: string;
  /** Filas por página. El backend admite hasta 100 (ver PAGE_SIZE_MAXIMO). */
  page_size?: number;
}

/**
 * Cliente de la API de comprobantes.
 *
 * TA-59: antes devolvía la respuesta CRUDA del backend, así que la grilla
 * buscaba `clienteRuc` donde llegaba `cliente_documento` y `total` donde llegaba
 * `monto_total`, y quedaba vacía. Ahora todo pasa por `invoiceMapper`, que es la
 * única pieza que conoce los dos contratos.
 *
 * Los filtros se envían solo si tienen valor: mandar `estado=` (vacío) hace que
 * el backend filtre por una cadena vacía y no devuelva nada.
 */
export interface SaldoNota { cantidades_pendientes: CantidadNota[]; total: number; devuelto: number; disponible: number; }

export type ResultadoConsultaSunat =
  | { tipo: 'RECUPERADO'; estado: string; codigo: string | null; mensaje?: string | null; referencia?: string | null }
  | { tipo: 'NO_ENCONTRADO' }
  | { tipo: 'INCIERTO'; motivo: string };

export interface ResultadoReprocesoPuente {
  completo: boolean; yaCompleto: boolean; asientoId?: string; asientoOmitido: boolean;
  asientoCostoId?: string; costoVenta?: number; kardex: 'COMPLETO' | 'PENDIENTE';
  movimientosRegistrados: number; movimientosOmitidos: number; errores: string[];
}

export const invoicesApi = {
  reprocesarPuente: async (id: string): Promise<ResultadoReprocesoPuente> => {
    const { data } = await apiClient.post<ResultadoReprocesoPuente>(`/invoices/${encodeURIComponent(id)}/reprocesar-puente`);
    return data;
  },
  previsualizarBaja: async (fecha: string, lineas: SeleccionBaja[]): Promise<VistaPreviaResumen> => {
    const { data } = await apiClient.post<VistaPreviaResumen>('/invoices/resumenes/baja/vista', { lineas }, { params: { fecha } }); return data;
  },
  enviarBaja: async (fecha: string, lineas: SeleccionBaja[]): Promise<ResultadoEnvioAgregado> => {
    const { data } = await apiClient.post<ResultadoEnvioAgregado>('/invoices/resumenes/baja/enviar', { lineas }, { params: { fecha } }); return data;
  },
  getAgregados: async (): Promise<AgregadoFiscal[]> => { const { data } = await apiClient.get<AgregadoFiscal[]>('/invoices/resumenes/envios'); return data; },
  consultarAgregado: async (identifier: string): Promise<{ motivo: string | null; status: string | null }> => {
    const { data } = await apiClient.post<{ motivo: string | null; status: string | null }>(`/invoices/resumenes/envios/${encodeURIComponent(identifier)}/consultar`, undefined, { timeout: 120_000 }); return data;
  },
  consultarSunat: async (id: string): Promise<ResultadoConsultaSunat> => {
    const { data } = await apiClient.post<ResultadoConsultaSunat>(`/invoices/${encodeURIComponent(id)}/consultar-sunat`);
    if (!data || !['RECUPERADO', 'NO_ENCONTRADO', 'INCIERTO'].includes(data.tipo) ||
      (data.tipo === 'RECUPERADO' && (typeof data.estado !== 'string' || (data.codigo !== null && typeof data.codigo !== 'string'))) ||
      (data.tipo === 'INCIERTO' && typeof data.motivo !== 'string')) throw new Error('Respuesta de consulta SUNAT no válida.');
    return data;
  },
  getSaldoNota: async (id: string): Promise<SaldoNota> => {
    const { data } = await apiClient.get<SaldoNota>(`/invoices/${encodeURIComponent(id)}/saldo`);
    if (![data.total, data.devuelto, data.disponible].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) throw new Error('El saldo recibido no es válido.');
    if (!Array.isArray(data.cantidades_pendientes) || data.cantidades_pendientes.some(c => !c || typeof c.codigo !== 'string' || !c.codigo.trim() || ![c.original, c.pendiente].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0))) throw new Error('Las cantidades pendientes recibidas no son válidas.');
    return data;
  },
  getInvoices: async (
    page = 1,
    filtros: FiltrosInvoices = {},
    forzarRed = false,
  ): Promise<{
    data: Invoice[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params: Record<string, string | number> = { page };

    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
        params[clave] = String(valor).trim();
      }
    }

    const leerRed = async () => {
      const response = await apiClient.get<PaginaBackend>('/invoices', { params });
      return aPaginaInvoices(response.data);
    };
    return forzarRed ? leerRed() : cachedGet(`invoices:${JSON.stringify(params)}`, leerRed);
  },

  getInvoiceById: async (id: string): Promise<Invoice> => {
    return cachedGet(`invoice:${id}`, async () => {
      const response = await apiClient.get<ComprobanteDetalleBackend>(
        `/invoices/${id}`,
      );
      return aInvoiceDetalle(response.data);
    });
  },

  createInvoice: async (dto: CreateInvoiceDto, idempotencyKey: string): Promise<Invoice> => {
    const response = await apiClient.post<ComprobanteBackend>(
      '/invoices',
      aCreateInvoiceDto(dto),
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return aInvoice(response.data);
  },

  /**
   * Emisión desde la pantalla: lo que llena el usuario.
   *
   * POR QUÉ NO SE USA `createInvoice`
   *
   * `POST /invoices` exige el contrato fiscal completo (`ruc_emisor`,
   * `tipo_comprobante`, `correlativo`, `payload_ubl`). El formulario no tiene
   * nada de eso: el usuario escribe el cliente y las líneas. Enviarlo ahí hacía
   * que el `whitelistValidation` del backend respondiera 400 a todas las
   * emisiones —comprobado contra el servidor real el 31-10—, así que la
   * pantalla nunca pudo emitir.
   *
   * `POST /invoices/emitir` acepta la forma del formulario y deja que el
   * backend liquide los impuestos, valide el stock y reserve el correlativo.
   * El número que devuelve es el real, no uno inventado.
   */
  emitirComprobante: async (
    dto: EmitirComprobantePayload,
    idempotencyKey: string,
  ): Promise<ResultadoEmisionBackend> => {
    const response = await apiClient.post<ResultadoEmisionBackend>(
      '/invoices/emitir',
      dto,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return response.data;
  },

  retryCdr: async (
    id: string,
  ): Promise<{ id: string; estado: string; encolado: boolean; mensaje: string }> => {
    const response = await apiClient.post<{
      id: string;
      estado: string;
      encolado: boolean;
      mensaje: string;
    }>(`/invoices/${id}/retry-cdr`);
    return response.data;
  },

  /**
   * Descarga el XML, el PDF o el CDR QUE PRODUJO EL BACKEND.
   *
   * POR QUÉ NO SE GENERA EN EL NAVEGADOR
   *
   * El modal de auditoría llamaba a `generarXmlUbl21Comprobante(c)` y
   * `descargarPdfComprobante(c)`, que reconstruían el documento en el cliente a
   * partir de los datos de la grilla. Ese XML NO es el que se envió a SUNAT: el
   * que vale es el que generó y firmó el backend. Entregarle al usuario una
   * reconstrucción con el mismo nombre es peor que no darle nada, porque parece
   * el documento fiscal y no lo es.
   *
   * El backend ya tenía `GET /invoices/:id/{xml,pdf,cdr}` funcionando (probado
   * contra comprobantes ACEPTADOS). Aquí se consumen de verdad.
   *
   * Si el backend responde 404 (el comprobante aún no tiene CDR, o no existe),
   * se propaga el error para que la pantalla lo diga en lugar de descargar un
   * archivo vacío.
   */
  descargarDocumento: async (
    id: string,
    formato: 'xml' | 'pdf' | 'cdr',
  ): Promise<{ blob: Blob; nombre: string }> => {
    const response = await apiClient.get(`/invoices/${id}/${formato}`, {
      responseType: 'blob',
    }).catch(async (error: unknown) => {
      const http = error as { response?: { data?: unknown } };
      if (http.response?.data instanceof Blob) {
        try { http.response.data = JSON.parse(await http.response.data.text()); }
        catch { /* Un cuerpo binario sin motivo se trata con el fallback estándar. */ }
      }
      throw error;
    });

    // El nombre real viaja en Content-Disposition; si falta, se arma uno.
    const disposicion = String(response.headers['content-disposition'] ?? '');
    const coincidencia = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposicion);
    const nombre = coincidencia
      ? decodeURIComponent(coincidencia[1])
      : `comprobante.${formato === 'cdr' ? 'cdr.xml' : formato}`;

    return { blob: response.data as Blob, nombre };
  },

  /**
   * Métricas del periodo (TA-69).
   *
   * Suma en el servidor sobre toda la empresa, no sobre la página visible: es
   * la única forma de que la cifra de "facturado del periodo" no cambie al
   * pasar de página. El periodo va como `YYYY-MM`; sin él el backend usa el
   * actual.
   */
  getMetrics: async (periodo?: string): Promise<MetricasFacturacion> => {
    const params: Record<string, string> = {};
    if (periodo && periodo.trim() !== '') params.periodo = periodo.trim();

    const response = await apiClient.get<Partial<MetricasFacturacion>>(
      '/invoices/metrics',
      { params },
    );
    return normalizarMetricas(response.data, periodo);
  },

  /**
   * Buscador de clientes (TA-61).
   *
   * Devuelve la cartera que la empresa ya usó en sus comprobantes. Sin `q`
   * trae la lista completa, que es lo que necesita el desplegable al abrirse;
   * con `q` filtra por documento o razón social en el servidor.
   */
  buscarClientes: async (q?: string): Promise<ClienteBuscado[]> => {
    const params: Record<string, string> = {};
    if (q && q.trim() !== '') params.q = q.trim();

    return cachedGet(`invoice-customers:${params.q ?? ''}`, async () => {
      const response = await apiClient.get<
        Array<{
          tipoDocumento?: string;
          numeroDocumento?: string;
          razonSocial?: string;
        }>
      >('/invoices/customers/lookup', { params });

      return (response.data ?? []).map((c) => ({
        tipoDocumento: (c.tipoDocumento ?? '6').trim(),
        numeroDocumento: (c.numeroDocumento ?? '').trim(),
        razonSocial: (c.razonSocial ?? '').trim(),
      }));
    });
  },

  /**
   * Alertas operativas (TA-69): certificado por vencer y comprobantes en la DLQ.
   *
   * Se pide aparte de las métricas porque la DLQ consulta pg-boss y no debe
   * retrasar el pintado de las cifras del periodo.
   */
  getAlertas: async (): Promise<AlertasOperativas> => {
    const response = await apiClient.get<Partial<AlertasOperativas>>(
      '/invoices/alertas',
    );
    return normalizarAlertas(response.data);
  },
  /**
   * Vista previa del resumen diario de boletas (RC) — TA-67.
   *
   * El apartado "Bajas y Resúmenes Diarios" mostraba la misma grilla de
   * comprobantes que "Facturas y Boletas". Un resumen no es un comprobante
   * suelto: es un envío agregado con su identificador RC-AAAAMMDD-NNN.
   */
  getVistaResumen: async (fecha?: string, correlativo = 1): Promise<VistaPreviaResumen> => {
    const params: Record<string, string> = { correlativo: String(correlativo) };
    if (fecha) params.fecha = fecha;
    const response = await apiClient.get<VistaPreviaResumen>(
      '/invoices/resumenes/diario',
      { params },
    );
    return response.data;
  },

  /** Vista previa de la comunicación de baja (RA) — TA-67. */
  getVistaBaja: async (fecha?: string, correlativo = 1): Promise<VistaPreviaResumen> => {
    const params: Record<string, string> = { correlativo: String(correlativo) };
    if (fecha) params.fecha = fecha;
    const response = await apiClient.get<VistaPreviaResumen>(
      '/invoices/resumenes/baja',
      { params },
    );
    return response.data;
  },

  /**
   * ENVÍA el resumen diario de boletas (D11).
   *
   * `POST /invoices/resumenes/diario/enviar` arma el XML, lo firma, lo comprime
   * y lo ENCOLA; SUNAT responde con un TICKET y el CDR llega después, por el
   * worker de resúmenes. Por eso la respuesta trae `jobId` y no un CDR: no hay
   * veredicto todavía y no se puede pintar uno.
   *
   * `enviado: false` NO es un error de red: es una decisión del backend con el
   * motivo (vista con errores, nada que informar, plazo de la regla 2957). Se
   * devuelve tal cual para que la pantalla lo muestre sin inventar.
   */
  enviarResumenDiario: async (
    fecha: string,
  ): Promise<ResultadoEnvioAgregado> => {
    const response = await apiClient.post<ResultadoEnvioAgregado>(
      '/invoices/resumenes/diario/enviar',
      undefined,
      { params: { fecha } },
    );
    return response.data;
  },
};

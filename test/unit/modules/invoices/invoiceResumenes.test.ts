/**
 * Vista previa de resúmenes (RC) y bajas (RA) — TA-67.
 *
 * El docente preguntó en la revisión: "No sé a qué se refiere con el caso de las
 * bajas". Lo que protege esta prueba es que la pantalla diga CON CLARIDAD qué se
 * envía y qué no, porque un resumen con menos líneas de las emitidas hace
 * pensar que el sistema perdió comprobantes.
 */
import { describe, expect, it } from 'vitest';
import { tipoComprobantePorPerfil } from '@/modules/invoices/hooks/useInvoiceConfig';
import {
  esLineaReenviable,
  ETIQUETA_ESTADO_SUNAT,
  ETIQUETA_TIPO,
  hayAlgoQueEnviar,
  resumirVista,
  type VistaPreviaResumen,
} from '@/modules/invoices/lib/invoiceResumenes';

const vista = (over: Partial<VistaPreviaResumen> = {}): VistaPreviaResumen => ({
  envio: {
    identificador: 'RC-20261031-001',
    tipo: 'RESUMEN_DIARIO',
    fechaReferencia: '2026-10-31',
    correlativo: 1,
    lineas: 2,
  },
  lineas: [
    {
      serie: 'B001',
      correlativo: 25,
      tipoComprobante: '03',
      fechaEmision: '2026-10-31',
      estado: 'ACEPTADO',
      total: 590,
      incluido: true,
      motivoExclusion: '',
      dias: 0,
    },
    {
      serie: 'B001',
      correlativo: 26,
      tipoComprobante: '03',
      fechaEmision: '2026-10-31',
      estado: 'ACEPTADO',
      total: 118,
      incluido: true,
      motivoExclusion: '',
      dias: 0,
    },
  ],
  xml: '<SummaryDocuments/>',
  errores: [],
  ...over,
});

describe('TA-67 · resumen de la vista previa', () => {
  it('cuenta incluidos y suma su importe', () => {
    const r = resumirVista(vista());
    expect(r.incluidos).toBe(2);
    expect(r.excluidos).toBe(0);
    expect(r.importe).toBe(708);
  });

  it('cuenta los excluidos aparte', () => {
    const v = vista({
      lineas: [
        ...vista().lineas,
        {
          serie: 'B001',
          correlativo: 27,
          tipoComprobante: '03',
          fechaEmision: '2026-10-01',
          estado: 'ACEPTADO',
          total: 50,
          incluido: false,
          motivoExclusion: 'Fuera del plazo de 7 días (regla 2957).',
          dias: 30,
        },
      ],
    });

    const r = resumirVista(v);
    expect(r.incluidos).toBe(2);
    expect(r.excluidos).toBe(1);
    // El excluido NO suma su importe: no se envía.
    expect(r.importe).toBe(708);
  });

  it('una vista vacía no rompe la pantalla', () => {
    const r = resumirVista(null);
    expect(r.incluidos).toBe(0);
    expect(r.excluidos).toBe(0);
    expect(r.importe).toBe(0);
  });

  it('redondea el importe a céntimos', () => {
    const v = vista({
      lineas: [
        {
          serie: 'B001',
          correlativo: 1,
          tipoComprobante: '03',
          fechaEmision: '2026-10-31',
          estado: 'ACEPTADO',
          total: 0.1,
          incluido: true,
          motivoExclusion: '',
          dias: 0,
        },
        {
          serie: 'B001',
          correlativo: 2,
          tipoComprobante: '03',
          fechaEmision: '2026-10-31',
          estado: 'ACEPTADO',
          total: 0.2,
          incluido: true,
          motivoExclusion: '',
          dias: 0,
        },
      ],
    });
    expect(resumirVista(v).importe).toBe(0.3);
  });

  it('sabe si hay algo que enviar', () => {
    expect(hayAlgoQueEnviar(vista())).toBe(true);
    expect(hayAlgoQueEnviar(vista({ xml: null }))).toBe(false);
    expect(hayAlgoQueEnviar(null)).toBe(false);
  });

  it('etiqueta los tipos del Catálogo 01', () => {
    expect(ETIQUETA_TIPO['03']).toBe('Boleta');
    expect(ETIQUETA_TIPO['01']).toBe('Factura');
    expect(ETIQUETA_TIPO['07']).toBe('Nota de crédito');
    expect(ETIQUETA_TIPO['08']).toBe('Nota de débito');
  });

  it('identifica filas que nunca llegaron a SUNAT como reenviables y rotula su estado', () => {
    expect(esLineaReenviable({ estado: 'ERROR_RED' })).toBe(true);
    expect(esLineaReenviable({ estado: 'PENDIENTE', reenviable: false })).toBe(false);
    expect(esLineaReenviable({ estado: 'ERROR_RED', reenviable: false })).toBe(false);
    expect(esLineaReenviable({ estado: 'PENDIENTE' })).toBe(true);
    expect(esLineaReenviable({ estado: 'EN_COLA' })).toBe(true);
    expect(esLineaReenviable({ estado: 'ACEPTADO' })).toBe(false);
    expect(ETIQUETA_ESTADO_SUNAT.ERROR_RED).toContain('Error de transporte');
    expect(ETIQUETA_ESTADO_SUNAT.ACEPTADO).toContain('Aceptado por SUNAT');
  });

  it('preselecciona Factura (01) para perfil MAYORISTA y Boleta (03) para perfil MINORISTA', () => {
    expect(tipoComprobantePorPerfil('MAYORISTA')).toBe('01');
    expect(tipoComprobantePorPerfil('MINORISTA')).toBe('03');
    expect(tipoComprobantePorPerfil(null)).toBeNull();
  });
});

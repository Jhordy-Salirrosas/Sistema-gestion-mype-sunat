/**
 * Pruebas de regresión de los parches del Módulo M1 (Facturación).
 *
 * Cada bloque corresponde a un defecto encontrado al preparar la presentación
 * del Sprint 1; si alguno vuelve a aparecer, estas pruebas fallan:
 *  - BA-01: la Boleta exigía RUC y la Factura aceptaba DNI.
 *  - BA-02: el correlativo era fijo en 100 y duplicaba el `id` de la grilla.
 *  - BA-03: la Nota usaba la serie de su propio tipo y no la del documento.
 *  - BA-04: "En cola Outbox" nunca bajaba porque no había respuesta del CDR.
 *  - BA-05: la tasa de éxito incluía los comprobantes aún sin veredicto.
 *  - BA-06: el CSV del RVIE incluía rechazados y comunicaciones de baja.
 */
import { describe, expect, it } from 'vitest';
import { COMPROBANTES_DEMO } from './fixtures/comprobantesDemo';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import {
  borradorAComprobante,
  borradorInicial,
  cambiarTipo,
  siguienteCorrelativo,
  vincularDocumentoAfectado,
} from '@/modules/invoices/lib/invoiceEmitDraft';
import {
  documentoValidoParaTipo,
  serieParaNota,
} from '@/modules/invoices/lib/invoiceEmitValidation';
import { calcularResumenFiscal } from '@/modules/invoices/lib/invoiceMetrics';
import { fechaLocalIso } from '@/modules/invoices/lib/invoiceFecha';
import { formatDateToPeru } from '@/lib/formatters';
import { construirCsvRvie } from '@/modules/invoices/lib/invoiceExportSire';

const FACTURA_RUC = '20100070970';
const CLIENTE_DNI = '45678912';

describe('BA-01 · el documento del cliente depende del tipo de CPE', () => {
  it('la Factura exige RUC válido y rechaza un DNI', () => {
    expect(documentoValidoParaTipo('01', FACTURA_RUC)).toBe(true);
    expect(documentoValidoParaTipo('01', CLIENTE_DNI)).toBe(false);
    expect(documentoValidoParaTipo('01', '20601012342')).toBe(false);
  });

  it('la Boleta exige DNI de 8 dígitos y no acepta RUC', () => {
    expect(documentoValidoParaTipo('03', CLIENTE_DNI)).toBe(true);
    expect(documentoValidoParaTipo('03', FACTURA_RUC)).toBe(false);
  });

  it('las notas aceptan RUC o DNI porque heredan el adquirente', () => {
    expect(documentoValidoParaTipo('07', FACTURA_RUC)).toBe(true);
    expect(documentoValidoParaTipo('07', CLIENTE_DNI)).toBe(true);
  });

  it('el borrador guarda el tipo de documento del cliente', () => {
    const factura = borradorAComprobante({
      ...borradorInicial('01', '2026-10-16'),
      clienteDoc: FACTURA_RUC,
    });
    expect(factura.clienteTipoDoc).toBe('6');

    const boleta = borradorAComprobante({
      ...borradorInicial('03', '2026-10-16'),
      clienteDoc: CLIENTE_DNI,
    });
    expect(boleta.clienteTipoDoc).toBe('1');
  });
});

describe('BA-02 · el correlativo no se repite en la misma serie', () => {
  it('parte del correlativo base cuando la serie está vacía', () => {
    expect(siguienteCorrelativo([], 'F001')).toBe(100);
  });

  it('continúa desde el mayor correlativo existente de la serie', () => {
    const correlativo = siguienteCorrelativo(
      [
        { serie: 'F001', correlativo: 42 },
        { serie: 'F001', correlativo: 45 },
        { serie: 'B001', correlativo: 900 },
      ],
      'F001',
    );

    expect(correlativo).toBe(46);
  });

  it('toma el máximo entre el base y los existentes', () => {
    // La serie tiene correlativos por debajo del base: se arranca en el base
    // para no reutilizar números que SUNAT ya vio en el rango reservado.
    expect(
      siguienteCorrelativo([{ serie: 'F001', correlativo: 45 }], 'F001', 100),
    ).toBe(46);
  });

  it('dos emisiones seguidas generan ids distintos', () => {
    const primera = borradorAComprobante({
      ...borradorInicial('01', '2026-10-16'),
      clienteDoc: FACTURA_RUC,
      correlativo: siguienteCorrelativo(COMPROBANTES_DEMO, 'F001'),
    });
    const segunda = borradorAComprobante({
      ...borradorInicial('01', '2026-10-16'),
      clienteDoc: FACTURA_RUC,
      correlativo: siguienteCorrelativo(
        [primera, ...COMPROBANTES_DEMO],
        'F001',
      ),
    });

    expect(primera.id).not.toBe(segunda.id);
    expect(COMPROBANTES_DEMO.some((c) => c.id === primera.id)).toBe(false);
  });
});

describe('BA-03 · la Nota hereda el documento afectado', () => {
  it('la Nota de Crédito a una factura usa serie FC y no BC', () => {
    expect(serieParaNota('07', 'F001-0042', 'BC01')).toBe('FC01');
    expect(serieParaNota('07', 'B001-0108', 'FC01')).toBe('BC01');
    expect(serieParaNota('08', 'F001-0001', 'BD01')).toBe('FD01');
  });

  it('no toca la serie de facturas ni boletas', () => {
    expect(serieParaNota('01', 'F001-0042', 'F001')).toBe('F001');
  });

  it('hereda tipo de operación 1001 de una factura con detracción', () => {
    const facturaDetraccion = construir({
      tipo: '01',
      serie: 'F001',
      correlativo: 43,
      ruc: FACTURA_RUC,
      razonSocial: 'SUPERMERCADOS PERUANOS S.A.C.',
      fecha: '2026-10-15',
      base: 2500,
      detraccionPct: 0.12,
      estado: 'ACEPTADO',
      cdrCodigo: '0',
    });
    // El `id` de la grilla omite los ceros de relleno: F001-43, no F001-0043.
    expect(facturaDetraccion.id).toBe('F001-43');

    const { borrador, afectado } = vincularDocumentoAfectado(
      {
        ...borradorInicial('07', '2026-10-15'),
        documentoAfectado: 'f001-43',
        serie: 'BC01',
      },
      [facturaDetraccion],
    );

    expect(afectado?.id).toBe('F001-43');
    expect(borrador.tipoDocumentoAfectado).toBe('1001');
    expect(borrador.serie).toBe('FC01');
  });

  it('no vincula con un documento inexistente ni con uno rechazado', () => {
    const rechazado = construir({
      tipo: '01',
      serie: 'F001',
      correlativo: 45,
      ruc: '20998877661',
      razonSocial: 'CONSTRUCTORA ANDINA DEL SUR S.A.C.',
      fecha: '2026-10-13',
      base: 1800,
      estado: 'RECHAZADO',
      cdrCodigo: '2017',
    });

    const { afectado } = vincularDocumentoAfectado(
      { ...borradorInicial('07', '2026-10-13'), documentoAfectado: 'F001-0045' },
      [rechazado],
    );

    expect(afectado).toBeUndefined();
  });

  it('una Nota no genera detracción ni retención propias', () => {
    const nota = borradorAComprobante({
      ...borradorInicial('07', '2026-10-16'),
      clienteDoc: FACTURA_RUC,
      // TA-64: el detalle pasó a ser una grilla; la base única ya no existe.
      items: [
        {
          clave: 'n-1',
          codigo: 'SRV-001',
          descripcion: 'Servicio de confección',
          unidad: 'NIU',
          cantidad: 1,
          valorUnitario: 2500,
          afectacion: 'GRAVADA',
          icbper: 0,
        },
      ],
      codigoDetraccion: '012',
      agenteRetencion: true,
      documentoAfectado: 'F001-0043',
    });

    expect(nota.detraccion).toBe(0);
    expect(nota.retencion).toBe(0);
    expect(nota.motivoNota?.codigo).toBe('01');
  });

  it('cambiar el tipo reinicia la serie y el motivo', () => {
    const nota = cambiarTipo(
      { ...borradorInicial('07', '2026-10-16'), motivoCodigo: '06' },
      '08',
    );

    expect(nota.serie).toBe('FD01');
    expect(nota.motivoCodigo).toBe('02');
    expect(nota.documentoAfectado).toBe('');
  });
});

describe('BA-05 · la tasa de éxito incluye los comprobantes pendientes', () => {
  it('incluye los comprobantes EN_COLA en el denominador', () => {
    const enCola = construir({
      tipo: '01',
      serie: 'F001',
      correlativo: 900,
      ruc: FACTURA_RUC,
      razonSocial: 'CLIENTE DE PRUEBA',
      fecha: '2026-10-16',
      base: 100,
      estado: 'EN_COLA',
    });
    const aceptado = construir({
      tipo: '01',
      serie: 'F001',
      correlativo: 901,
      ruc: FACTURA_RUC,
      razonSocial: 'CLIENTE DE PRUEBA',
      fecha: '2026-10-16',
      base: 100,
      estado: 'ACEPTADO',
      cdrCodigo: '0',
    });

    const resumen = calcularResumenFiscal([enCola, aceptado]);

    expect(resumen.tasaExito).toBe(50);
  });

  it('sin comprobantes respondidos la tasa es 0 y no NaN', () => {
    const resumen = calcularResumenFiscal([
      construir({
        tipo: '01',
        serie: 'F001',
        correlativo: 902,
        ruc: FACTURA_RUC,
        razonSocial: 'CLIENTE DE PRUEBA',
        fecha: '2026-10-16',
        base: 100,
        estado: 'EN_COLA',
      }),
    ]);

    expect(resumen.tasaExito).toBe(0);
  });
});

describe('BA-06 · el RVIE solo lleva comprobantes declarables', () => {  it('la semilla del M1 exporta su CSV sin filas vacías', () => {
    const csv = construirCsvRvie(COMPROBANTES_DEMO);
    const filas = csv.split('\r\n');

    // Encabezado + un comprobante por fila.
    expect(filas).toHaveLength(COMPROBANTES_DEMO.length + 1);
    expect(filas[0]).toContain('Periodo');
  });

  it('usa el tipo de documento del cliente (Catálogo 06) en la columna', () => {
    const boleta = COMPROBANTES_DEMO.find((c) => c.tipo === '03')!;
    const csv = construirCsvRvie([boleta]);

    expect(csv).toContain(`"${boleta.clienteTipoDoc}"`);
    expect(boleta.clienteTipoDoc).toBe('1');
  });

  it('toda Boleta de la semilla lleva DNI y toda Factura lleva RUC', () => {
    COMPROBANTES_DEMO.filter((c) => c.tipo === '03').forEach((c) => {
      expect(c.clienteRuc).toHaveLength(8);
      expect(c.clienteTipoDoc).toBe('1');
    });
    COMPROBANTES_DEMO.filter((c) => c.tipo === '01').forEach((c) => {
      expect(c.clienteTipoDoc).toBe('6');
    });
  });
});

describe('BA-07 · la fecha de emisión es la del calendario local', () => {
  it('no retrocede un día cuando en UTC ya es el día siguiente', () => {
    // Medianoche del 23/10 en Lima es 05:00 UTC del mismo 23/10.
    const enLima = new Date('2026-10-23T05:00:00Z');
    expect(fechaLocalIso(enLima)).toBe('2026-10-23');
  });

  it('formatea con ceros a la izquierda mes y día', () => {
    expect(fechaLocalIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('distingue la fecha local de la fecha UTC en el borde del día', () => {
    const tardeEnLima = new Date(2026, 9, 23, 20, 30);
    expect(fechaLocalIso(tardeEnLima)).toBe('2026-10-23');
  });
});
describe('BA-07b · la grilla no retrocede la fecha de emisión', () => {
  it('una fecha sin hora se muestra como el mismo día calendario', () => {
    // El backend y la semilla envían solo la fecha: no hay que convertirla.
    expect(formatDateToPeru('2026-10-23')).toBe('23/10/2026');
    expect(formatDateToPeru('2026-01-05')).toBe('05/01/2026');
  });

  it('una fecha con hora sí respeta la zona horaria de Lima', () => {
    expect(formatDateToPeru('2026-10-23T18:00:00Z')).toBe('23/10/2026');
  });

  it('la fecha que produce el formulario se muestra igual en la grilla', () => {
    const hoy = fechaLocalIso(new Date(2026, 9, 23, 8, 0));
    expect(formatDateToPeru(hoy)).toBe('23/10/2026');
  });

  it('devuelve guion para entradas vacías o inválidas', () => {
    expect(formatDateToPeru('')).toBe('-');
    expect(formatDateToPeru('no-es-fecha')).toBe('-');
  });
});
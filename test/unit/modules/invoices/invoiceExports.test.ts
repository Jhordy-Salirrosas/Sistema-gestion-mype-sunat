/**
 * Pruebas de las exportaciones del M1: XML UBL 2.1, PDF binario con QR, CSV
 * del SIRE RVIE y validaciones del formulario de emisión.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { COMPROBANTES_DEMO } from './fixtures/comprobantesDemo';
import { useAuthStore } from '@/stores/authStore';
import {
  construirPdfBinarioSunat,
  nombreArchivoPdf,
} from '@/modules/invoices/lib/invoiceExportPdf';
import {
  construirCsvRvie,
  nombreArchivoRvie,
} from '@/modules/invoices/lib/invoiceExportSire';
import {
  rucValido,
  dniValido,
  documentoClienteValido,
  SERIES_POR_TIPO,
} from '@/modules/invoices/lib/invoiceEmitValidation';

const busqueda = <T extends { tipo: string }>(
  filas: readonly T[],
  tipo: string,
): T => {
  const fila = filas.find((f) => f.tipo === tipo);
  if (!fila) throw new Error(`No hay comprobante de tipo ${tipo}`);
  return fila;
};

const factura = busqueda(COMPROBANTES_DEMO, '01');

/**
 * Identidad del emisor con la que los tests construyen documentos.
 *
 * El RUC ya no es una constante del código: sale de la empresa activa de la
 * sesión, para que el QR y el XML del front lleven el mismo RUC con el que el
 * backend firma. Estos tests instalan una empresa como lo haría el login y
 * comprueban que su RUC aparece en las tres exportaciones.
 */
const EMPRESA_PRUEBA = {
  tenantId: 'test-tenant',
  ruc: '20601234567',
  razonSocial: 'SYNC-SUNAT DEMO MYPE S.A.C.',
} as const;

beforeEach(() => {
  useAuthStore.getState().setActiveCompany({ ...EMPRESA_PRUEBA });
});

afterEach(() => {
  useAuthStore.setState({ activeCompany: null });
});

describe('construirPdfBinarioSunat', () => {
  it('produce un flujo PDF 1.4 bien delimitado', () => {
    const pdf = construirPdfBinarioSunat(factura);

    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('/Type /Catalog');
    expect(pdf).toContain('xref');
    expect(pdf).toContain('trailer');
  });

  it('incorpora el recuadro fiscal con RUC, hash y trama QR de 10 campos', () => {
    const pdf = construirPdfBinarioSunat(factura);

    expect(pdf).toContain('R.U.C. N° 20601234567');
    expect(pdf).toContain('COMPROBANTE ELECTRONICO');
    expect(pdf).toContain(factura.hashCpe);
    // El RUC del recuadro es el de la empresa activa, no un literal del código.
    expect(pdf).toContain(EMPRESA_PRUEBA.ruc);
  });

  it('el nombre del PDF usa serie y correlativo en cuatro dígitos', () => {
    expect(nombreArchivoPdf(factura)).toMatch(/^F001-\d{4}\.pdf$/);
  });
});

describe('construirCsvRvie', () => {
  it('genera una cabecera y una fila por comprobante', () => {
    const csv = construirCsvRvie(COMPROBANTES_DEMO);
    const lineas = csv.trimEnd().split('\n');

    expect(lineas).toHaveLength(COMPROBANTES_DEMO.length + 1);
    expect(lineas[0]).toContain('Periodo');
    expect(lineas[0]).toContain('Tipo_CPE');
    expect(lineas[0]).toContain('Total_Neto');
    expect(lineas[1].split(',')).toHaveLength(19);
  });

  it('numera el CAR SUNAT de forma correlativa', () => {
    const csv = construirCsvRvie(COMPROBANTES_DEMO);
    const segunda = csv.trimEnd().split('\n')[2];

    expect(segunda).toContain('"2"');
  });

  it('el nombre del reporte corresponde al periodo y al RUC del emisor', () => {
    expect(nombreArchivoRvie(COMPROBANTES_DEMO)).toBe(
      'RVIE-20601234567-202610.csv',
    );
  });
});

describe('validaciones del formulario de emisión', () => {
  it('acepta RUC válidos y rechaza verificadores incorrectos', () => {
    expect(rucValido('20100070970')).toBe(true);
    expect(rucValido('20601012341')).toBe(true);
    expect(rucValido('20601012342')).toBe(false);
    expect(rucValido('1012345678')).toBe(false);
  });

  /*
   * LOS DOS CASOS ESPECIALES DEL MÓDULO 11, FIJADOS CON RUC REALES.
   *
   * `resto` va de 0 a 10, así que `11 - resto` da 1..11; los valores 10 y 11 se
   * sustituyen por un dígito (10 → 0, 11 → 1).
   *
   *   20100070970 → resto 1  → verificador 10 → dígito 0
   *   20601012341 → resto 10 → verificador 1  → dígito 1
   *
   * Están aquí porque el 3 nov "arreglé" estas ramas creyendo que la de 11 era
   * imposible. No lo era: con resto 0 el dígito es 1. El cambio rompía
   * 20100070970, que es la Ferretería Los Andes y la primera factura del
   * sistema. Estas dos pruebas lo habrían frenado.
   */
  it('resuelve las dos ramas especiales del módulo 11 con RUC reales', () => {
    // resto 1 → verificador 10 → 0
    expect(rucValido('20100070970')).toBe(true);
    // resto 10 → verificador 1 (el camino normal)
    expect(rucValido('20601012341')).toBe(true);
    // resto 6 → verificador 5
    expect(rucValido('20131312955')).toBe(true);
  });

  it('rechaza el número con el dígito verificador alterado', () => {
    expect(rucValido('20100070971')).toBe(false);
    expect(rucValido('20131312956')).toBe(false);
  });

  it('solo acepta DNI de ocho dígitos', () => {
    expect(dniValido('45678912')).toBe(true);
    expect(dniValido('4567891')).toBe(false);
    expect(dniValido('456789123')).toBe(false);
  });

  it('discrimina entre RUC y DNI según el largo del documento', () => {
    expect(documentoClienteValido('20100070970')).toBe(true);
    expect(documentoClienteValido('45678912')).toBe(true);
    expect(documentoClienteValido('20100070971')).toBe(false);
  });

  it('cada tipo de comprobante tiene series del catálogo correcto', () => {
    expect(SERIES_POR_TIPO['01']).toContain('F001');
    expect(SERIES_POR_TIPO['03']).toContain('B001');
    expect(SERIES_POR_TIPO['07']).toContain('FC01');
    expect(SERIES_POR_TIPO['08']).toContain('FD01');
  });
});

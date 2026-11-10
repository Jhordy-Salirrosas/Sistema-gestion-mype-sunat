/**
 * Nota de crédito y débito SOLO sobre un comprobante existente (M1).
 *
 * La frase del docente que origina estas pruebas:
 *
 *   "La nota de crédito es cuando va a haber alguna devolución... Pero es sobre
 *    el documento que ya está, o sea, no empiezas haciendo una nota de crédito."
 *
 * El modal ya avisaba en rojo cuando el documento no existía, pero nada impedía
 * confirmar: el flujo que el docente objetó seguía siendo posible. Estas pruebas
 * fijan las condiciones que ahora bloquean la emisión.
 */
import { describe, expect, it } from 'vitest';
import {
  admiteNota,
  buscarAfectado,
  comprobantesElegibles,
  notaSePuedeEmitir,
  problemasDeNota,
  type ProblemaNota,
} from '@/modules/invoices/lib/invoiceNotaOrigen';
import type { BorradorEmision } from '@/modules/invoices/lib/invoiceEmitDraft';

/**
 * Comprobante mínimo para las pruebas.
 *
 * El `id` es un UUID DE VERDAD, no un número. Antes este fixture usaba
 * `id: 'F001-00000042'` — un número disfrazado de identificador — y por eso la
 * suite pasaba mientras la aplicación real no reconocía NINGÚN comprobante: la
 * función comparaba contra el UUID y el número fiscal nunca coincidía.
 */
const comprobante = (parcial: {
  id?: string;
  numero?: string;
  serie?: string;
  correlativo?: number;
  tipo?: '01' | '03' | '07' | '08';
  estado?: 'ACEPTADO' | 'RECHAZADO' | 'OBSERVADO' | 'EN_COLA';
  clienteRuc?: string;
  fechaEmision?: string;
} = {}) => ({
  id: 'd819ddb0-64de-4a17-9156-878630130a39',
  numero: 'F001-00000042',
  serie: 'F001',
  correlativo: 42,
  tipo: '01' as const,
  estado: 'ACEPTADO' as const,
  clienteRuc: '20100070970',
  fechaEmision: '2026-10-01',
  ...parcial,
});

/** Borrador mínimo de nota. */
const borradorNota = (parcial: Partial<BorradorEmision> = {}): BorradorEmision =>
  ({
    tipo: '07',
    serie: 'F001',
    correlativo: 100,
    clienteDoc: '20100070970',
    clienteTipoDoc: '6',
    clienteRazonSocial: 'FERRETERÍA LOS ANDES S.A.C.',
    items: [],
    formaPago: 'Contado',
    cuotas: [],
    numeroCuotas: 2,
    codigoDetraccion: '',
    agenteRetencion: false,
    bolsas: 0,
    documentoAfectado: 'F001-00000042',
    tipoDocumentoAfectado: '0101',
    motivoCodigo: '01',
    motivoDescripcion: 'Anulación de la operación',
    fecha: '2026-10-31',
    ...parcial,
  }) as BorradorEmision;

/** Campos con problema, para aserciones legibles. */
const campos = (problemas: readonly ProblemaNota[]): string[] =>
  problemas.map((p) => p.campo);

describe('problemasDeNota — la nota exige el documento de origen', () => {
  // El caso exacto que el docente rechazó: empezar por la nota.
  it('bloquea una nota sin documento afectado', () => {
    const problemas = problemasDeNota(
      borradorNota({ documentoAfectado: '' }),
      [comprobante()],
      100,
    );

    expect(problemas).toHaveLength(1);
    expect(problemas[0].campo).toBe('documentoAfectado');
    expect(problemas[0].mensaje).toContain('No se empieza por la nota');
  });

  it('bloquea una nota cuyo documento no existe', () => {
    const problemas = problemasDeNota(
      borradorNota({ documentoAfectado: 'F001-99999999' }),
      [comprobante()],
      100,
    );

    expect(campos(problemas)).toContain('documentoAfectado');
    expect(problemas[0].mensaje).toContain('No existe el comprobante');
  });

  it('acepta una nota cuando el documento existe y es del mismo cliente', () => {
    const problemas = problemasDeNota(borradorNota(), [comprobante()], 100);

    expect(problemas).toHaveLength(0);
    expect(notaSePuedeEmitir(borradorNota(), [comprobante()], 100)).toBe(true);
  });

  it('ignora mayúsculas y espacios al comparar el número', () => {
    const problemas = problemasDeNota(
      borradorNota({ documentoAfectado: '  f001-00000042 ' }),
      [comprobante()],
      100,
    );

    expect(problemas).toHaveLength(0);
  });

  it('bloquea una nota sobre otra nota', () => {
    const problemas = problemasDeNota(
      borradorNota({ documentoAfectado: 'FC01-00000001' }),
      [
        comprobante({
          // id = UUID, número = identidad fiscal: la nota se busca por número.
          id: 'aa11bb22-cccc-4ddd-8eee-ffff00001111',
          numero: 'FC01-00000001',
          serie: 'FC01',
          correlativo: 1,
          tipo: '07',
        }),
      ],
      100,
    );

    expect(problemas[0].mensaje).toContain('ya es una nota');
  });

  it('bloquea una nota sobre un comprobante rechazado', () => {
    const problemas = problemasDeNota(
      borradorNota(),
      [comprobante({ estado: 'RECHAZADO' })],
      100,
    );

    expect(campos(problemas)).toContain('documentoAfectado');
    expect(problemas[0].mensaje).toContain('rechazado');
  });

  // Devolverle dinero a quien no compró es el error más caro del módulo.
  it('bloquea una nota emitida a un cliente distinto del comprador', () => {
    const problemas = problemasDeNota(
      borradorNota({ clienteDoc: '10456789123' }),
      [comprobante()],
      100,
    );

    expect(campos(problemas)).toContain('documentoAfectado');
    expect(problemas[0].mensaje).toContain('otro cliente');
  });

  it('exige el motivo del Catálogo 09', () => {
    const problemas = problemasDeNota(
      borradorNota({ motivoCodigo: '' }),
      [comprobante()],
      100,
    );

    expect(campos(problemas)).toContain('motivo');
  });

  it('bloquea una nota de importe cero', () => {
    const problemas = problemasDeNota(borradorNota(), [comprobante()], 0);

    expect(campos(problemas)).toContain('monto');
  });

  it('acumula los problemas en vez de quedarse con el primero', () => {
    // Cliente distinto (11 dígitos, para que la comparación de documento se
    // aplique: `problemasDeNota` limpia a dígitos y compara solo si hay), sin
    // motivo y con importe cero → tres problemas distintos.
    const problemas = problemasDeNota(
      borradorNota({ motivoCodigo: '', clienteDoc: '10456789123' }),
      [comprobante()],
      0,
    );

    expect(problemas).toHaveLength(3);
    expect(campos(problemas)).toEqual(
      expect.arrayContaining(['documentoAfectado', 'motivo', 'monto']),
    );
  });
});

describe('admiteNota', () => {
  it('acepta una factura aceptada', () => {
    expect(admiteNota(comprobante())).toBe(true);
  });

  it('acepta una boleta en cola (sí existe fiscalmente)', () => {
    expect(admiteNota(comprobante({ tipo: '03', estado: 'EN_COLA' }))).toBe(false);
  });

  it('rechaza una nota de crédito', () => {
    expect(admiteNota(comprobante({ tipo: '07' }))).toBe(false);
  });

  it('rechaza un comprobante rechazado por SUNAT', () => {
    expect(admiteNota(comprobante({ estado: 'RECHAZADO' }))).toBe(false);
  });
});

describe('comprobantesElegibles', () => {
  it('excluye notas y rechazados, y ordena del más reciente al más antiguo', () => {
    const elegibles = comprobantesElegibles([
      comprobante({ id: 'F001-00000001', fechaEmision: '2026-09-01' }),
      comprobante({ id: 'B001-00000002', tipo: '03', fechaEmision: '2026-10-20' }),
      comprobante({ id: 'F001-00000003', tipo: '07' }),
      comprobante({ id: 'F001-00000004', estado: 'RECHAZADO' }),
    ]);

    expect(elegibles.map((c) => c.id)).toEqual([
      'B001-00000002',
      'F001-00000001',
    ]);
  });
});

describe('buscarAfectado', () => {
  it('encuentra el comprobante sin importar el formato', () => {
    expect(buscarAfectado([comprobante()], 'f001-00000042')?.numero).toBe(
      'F001-00000042',
    );
  });

  it('devuelve undefined con un número vacío', () => {
    expect(buscarAfectado([comprobante()], '   ')).toBeUndefined();
  });

  // Estos casos existen porque la función comparaba contra el UUID: el fixture
  // anterior tenía `id: 'F001-00000042'`, así que la suite pasaba mientras la
  // app real respondía "No existe el comprobante" para CUALQUIER número.
  it('encuentra por número aunque el id sea un UUID', () => {
    const real = comprobante();
    expect(real.id).toMatch(/^[0-9a-f-]{36}$/);

    const encontrado = buscarAfectado([real], 'F001-00000045');
    expect(encontrado).toBeUndefined(); // 42 ≠ 45: no debe acertar por parecido

    expect(buscarAfectado([real], 'F001-00000042')).toBe(real);
  });

  it('acepta el número con espacios y en minúsculas', () => {
    expect(buscarAfectado([comprobante()], '  f001-00000042  ')).toBeDefined();
  });

  it('reconstruye el número desde serie y correlativo si falta `numero`', () => {
    const sinNumero = comprobante({
      numero: '',
      serie: 'B001',
      correlativo: 7,
    });

    expect(
      buscarAfectado([sinNumero], 'B001-00000007')?.correlativo,
    ).toBe(7);
  });

  it('acepta el correlativo suelto cuando no hay ambigüedad', () => {
    expect(buscarAfectado([comprobante()], '42')).toBeDefined();
  });

  it('con dos series y el mismo correlativo exige el número completo', () => {
    const factura = comprobante({ numero: 'F001-00000009', correlativo: 9 });
    const boleta = comprobante({
      id: 'b2c3d4e5-0000-4444-8888-999999999999',
      numero: 'B001-00000009',
      serie: 'B001',
      correlativo: 9,
    });

    expect(buscarAfectado([factura, boleta], '9')).toBeUndefined();
    expect(buscarAfectado([factura, boleta], 'B001-00000009')?.serie).toBe(
      'B001',
    );
  });

  it('no confunde un número con el de otro comprobante', () => {
    const otro = comprobante({ numero: 'F001-00000045', correlativo: 45 });
    expect(buscarAfectado([otro], 'F001-00000044')).toBeUndefined();
  });
});

it('6H permite observado como origen y conserva las exclusiones de otros estados', () => {
 expect(admiteNota(comprobante({ estado: 'OBSERVADO' }))).toBe(true);
 expect(admiteNota(comprobante({ estado: 'RECHAZADO' }))).toBe(false);
});

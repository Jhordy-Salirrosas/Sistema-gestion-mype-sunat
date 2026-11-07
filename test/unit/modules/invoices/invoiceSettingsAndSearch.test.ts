/**
 * TA-61 · configuración de FE y buscadores reactivos.
 *
 * Lo que se protege:
 *
 *  1. El RUC no se puede editar: cambiarlo invalidaría los comprobantes ya
 *     emitidos. La validación ni siquiera lo mira.
 *  2. La configuración no se guarda con datos incompletos: sin ubigeo el XML no
 *     puede llevar la dirección fiscal, y en producción sin cuenta del Banco de
 *     la Nación los comprobantes con detracción no dicen dónde depositar.
 *  3. El buscador de clientes prioriza el documento: al pegar un RUC de 11
 *     dígitos busca por documento y no por nombre.
 *  4. El buscador de productos pone primero las coincidencias de SKU.
 *  5. El debounce agrupa las pulsaciones: escribir "CORPORACION" no dispara once
 *     búsquedas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  avisoAmbiente,
  configuracionVacia,
  nombreTipo,
  serieCoherente,
  tieneErrores,
  validarConfiguracion,
  type ConfiguracionFe,
} from '@/modules/invoices/lib/invoiceSettings';
import {
  ESPERA_MS,
  campoDeBusqueda,
  conDebounce,
  debeBuscar,
  esDocumentoCompleto,
  filtrarClientes,
  filtrarProductos,
  normalizar,
  tipoDocumentoDe,
  type ClienteBuscado,
  type ProductoBuscado,
} from '@/modules/invoices/lib/invoiceSearch';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Configuración completa y válida. */
function config(extra: Partial<ConfiguracionFe> = {}): ConfiguracionFe {
  return {
    ...configuracionVacia('20601012341'),
    razonSocial: 'FERRETERIA LOS ANDES S.A.C.',
    direccion: 'Av. Larco 123 - Trujillo',
    ubigeo: '130101',
    ambiente: 'beta',
    ...extra,
  };
}

const CLIENTES: readonly ClienteBuscado[] = [
  {
    tipoDocumento: '6',
    numeroDocumento: '20100066603',
    razonSocial: 'CONSTRUCTORA DEL NORTE S.A.C.',
  },
  {
    tipoDocumento: '6',
    numeroDocumento: '20131312955',
    razonSocial: 'EMPRESA DE TRANSPORTES ANDINOS S.A.C.',
  },
  {
    tipoDocumento: '1',
    numeroDocumento: '70123456',
    razonSocial: 'PÉREZ GONZALES JUAN',
  },
];

const PRODUCTOS: readonly ProductoBuscado[] = [
  { sku: 'CEM-001', descripcion: 'Cemento Portland tipo I', unidad: 'BG', valorUnitario: 25, stock: 120 },
  { sku: 'FIE-001', descripcion: 'Fierro corrugado 1/2"', unidad: 'MTR', valorUnitario: 9.5, stock: 300 },
  { sku: 'CLA-001', descripcion: 'Clavos de 3 pulgadas', unidad: 'KGM', valorUnitario: 4.8, stock: 50 },
];

// ---------------------------------------------------------------------------
// 1 · Validación de la configuración
// ---------------------------------------------------------------------------

describe('TA-61 · validación de la configuración', () => {
  it('una configuración completa y válida no tiene errores', () => {
    const errores = validarConfiguracion(config());
    expect(tieneErrores(errores)).toBe(false);
  });

  it('la razón social es obligatoria', () => {
    const errores = validarConfiguracion(config({ razonSocial: '   ' }));
    expect(errores.razonSocial).toMatch(/obligatoria/);
  });

  it('la dirección fiscal es obligatoria', () => {
    const errores = validarConfiguracion(config({ direccion: '' }));
    expect(errores.direccion).toBeDefined();
  });

  it('el ubigeo debe tener 6 dígitos', () => {
    expect(validarConfiguracion(config({ ubigeo: '1301' })).ubigeo).toBeDefined();
    expect(
      validarConfiguracion(config({ ubigeo: '1301010' })).ubigeo,
    ).toBeDefined();
    expect(validarConfiguracion(config({ ubigeo: '130101' })).ubigeo).toBeUndefined();
  });

  it('el ubigeo vacío se rechaza', () => {
    // Sin ubigeo el XML no puede llevar RegistrationAddress.
    expect(validarConfiguracion(config({ ubigeo: '' })).ubigeo).toMatch(
      /obligatorio/,
    );
  });

  it('un correo con formato inválido se rechaza', () => {
    const errores = validarConfiguracion(config({ correoCopia: 'facturacion' }));
    expect(errores.correoCopia).toBeDefined();
  });

  it('un correo válido se acepta', () => {
    const errores = validarConfiguracion(
      config({ correoCopia: 'facturacion@empresa.pe' }),
    );
    expect(errores.correoCopia).toBeUndefined();
  });

  it('en producción la cuenta del Banco de la Nación es obligatoria', () => {
    // Sin ella, un comprobante con detracción no dice dónde depositar.
    const errores = validarConfiguracion(
      config({ ambiente: 'produccion', cuentaBancoNacion: '' }),
    );
    expect(errores.cuentaBancoNacion).toMatch(/producción/i);
  });

  it('en beta la cuenta es opcional', () => {
    const errores = validarConfiguracion(config({ ambiente: 'beta' }));
    expect(errores.cuentaBancoNacion).toBeUndefined();
  });

  it('la cuenta se valida como dígitos', () => {
    const errores = validarConfiguracion(
      config({ cuentaBancoNacion: '00-0191-23456' }),
    );
    // Los separadores se limpian, así que la cuenta vale.
    expect(errores.cuentaBancoNacion).toBeUndefined();
  });

  it('el RUC no se valida como editable: es de solo lectura', () => {
    // Un RUC inválido en el campo no genera error de configuración porque el
    // campo no se edita; lo validó el registro de la empresa en su momento.
    const errores = validarConfiguracion(config({ ruc: 'abc' }));
    expect(errores.ruc).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2 · Series y ambiente
// ---------------------------------------------------------------------------

describe('TA-61 · series y ambiente', () => {
  it('una factura usa serie F y una boleta serie B', () => {
    expect(serieCoherente('01', 'F001')).toBe(true);
    expect(serieCoherente('03', 'B001')).toBe(true);
  });

  it('una nota de crédito usa FC o BC', () => {
    expect(serieCoherente('07', 'FC01')).toBe(true);
    expect(serieCoherente('07', 'BC01')).toBe(true);
  });

  it('una factura NO puede usar una serie de nota de crédito', () => {
    expect(serieCoherente('01', 'FC01')).toBe(false);
  });

  it('una boleta NO puede usar una serie de factura', () => {
    expect(serieCoherente('03', 'F001')).toBe(false);
  });

  it('una serie de 3 caracteres se rechaza', () => {
    expect(serieCoherente('01', 'F01')).toBe(false);
  });

  it('el aviso de producción advierte de que los comprobantes son reales', () => {
    expect(avisoAmbiente('produccion')).toMatch(/validez tributaria real/);
  });

  it('el aviso de beta aclara que no tienen validez', () => {
    expect(avisoAmbiente('beta')).toMatch(/no tienen validez/);
  });

  it('los tipos se nombran en español', () => {
    expect(nombreTipo('01')).toBe('Factura');
    expect(nombreTipo('03')).toBe('Boleta de venta');
    expect(nombreTipo('99')).toBe('Tipo 99');
  });
});

// ---------------------------------------------------------------------------
// 3 · Buscador de clientes
// ---------------------------------------------------------------------------

describe('TA-61 · buscador de clientes', () => {
  it('un RUC completo se busca por documento y no por nombre', () => {
    expect(esDocumentoCompleto('20100066603')).toBe(true);
    expect(campoDeBusqueda('20100066603')).toBe('documento');
  });

  it('un prefijo de solo dígitos también se busca por documento', () => {
    // Exigir los 11 dígitos antes de ver sugerencias obligaría a recordarlos.
    expect(campoDeBusqueda('2010')).toBe('documento');
  });

  it('un texto con letras se busca por nombre', () => {
    expect(campoDeBusqueda('CONSTRUCTORA')).toBe('nombre');
    expect(campoDeBusqueda('2010 SAC')).toBe('nombre');
  });

  it('un DNI de 8 dígitos también es un documento completo', () => {
    expect(esDocumentoCompleto('70123456')).toBe(true);
    expect(campoDeBusqueda('70123456')).toBe('documento');
  });

  it('el tipo de documento se deriva de la longitud', () => {
    expect(tipoDocumentoDe('20100066603')).toBe('6');
    expect(tipoDocumentoDe('70123456')).toBe('1');
  });

  it('un texto corto no dispara búsqueda', () => {
    expect(debeBuscar('')).toBe(false);
    expect(debeBuscar('C')).toBe(false);
    expect(debeBuscar('CO')).toBe(true);
  });

  it('busca por razón social ignorando mayúsculas y tildes', () => {
    const resultados = filtrarClientes(CLIENTES, 'perez');
    expect(resultados).toHaveLength(1);
    expect(resultados[0].numeroDocumento).toBe('70123456');
  });

  it('busca por el comienzo del documento', () => {
    // "2013" coincide solo con el RUC que empieza así, no con todos los "20".
    const resultados = filtrarClientes(CLIENTES, '2013');
    expect(resultados).toHaveLength(1);
    expect(resultados[0].numeroDocumento).toBe('20131312955');
  });

  it('un prefijo corto devuelve todas las coincidencias', () => {
    // Los dos RUC de la lista empiezan por "20".
    expect(filtrarClientes(CLIENTES, '20')).toHaveLength(2);
  });

  it('sin coincidencias devuelve una lista vacía, no todos', () => {
    expect(filtrarClientes(CLIENTES, 'ZZZZ')).toEqual([]);
  });

  it('limita el número de resultados', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => ({
      tipoDocumento: '6',
      numeroDocumento: `201000${String(i).padStart(5, '0')}`,
      razonSocial: `CLIENTE ${i}`,
    }));

    expect(filtrarClientes(muchos, 'CLIENTE', 5)).toHaveLength(5);
  });

  it('normalizar quita tildes y mayúsculas', () => {
    expect(normalizar('PÉREZ GONZALES')).toBe('perez gonzales');
  });
});

// ---------------------------------------------------------------------------
// 4 · Buscador de productos
// ---------------------------------------------------------------------------

describe('TA-61 · buscador de productos', () => {
  it('encuentra un producto por su SKU', () => {
    const resultados = filtrarProductos(PRODUCTOS, 'CEM');
    expect(resultados[0].sku).toBe('CEM-001');
  });

  it('las coincidencias de SKU van antes que las de descripción', () => {
    // "CLA" es el comienzo del SKU CLA-001 y también está dentro de "Clavos".
    const resultados = filtrarProductos(PRODUCTOS, 'cla');
    expect(resultados[0].sku).toBe('CLA-001');
  });

  it('encuentra un producto por la descripción', () => {
    const resultados = filtrarProductos(PRODUCTOS, 'portland');
    expect(resultados).toHaveLength(1);
    expect(resultados[0].sku).toBe('CEM-001');
  });

  it('con una sola letra no busca', () => {
    expect(filtrarProductos(PRODUCTOS, 'c')).toEqual([]);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(filtrarProductos(PRODUCTOS, 'zzz')).toEqual([]);
  });

  it('el producto elegido trae su unidad y su valor unitario', () => {
    const [producto] = filtrarProductos(PRODUCTOS, 'CEM');
    expect(producto.unidad).toBe('BG');
    expect(producto.valorUnitario).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// 5 · Debounce
// ---------------------------------------------------------------------------

describe('TA-61 · debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrupa las pulsaciones en una sola llamada', () => {
    const fn = vi.fn();
    const { ejecutar } = conDebounce(fn);

    // Escribir "CORPORACION" son once llamadas seguidas.
    for (const letra of 'CORPORACION') ejecutar(letra);

    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ESPERA_MS);

    // Una sola consulta, con el texto final.
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('N');
  });

  it('cada pausa dispara su propia búsqueda', () => {
    const fn = vi.fn();
    const { ejecutar } = conDebounce(fn, 100);

    ejecutar('cemento');
    vi.advanceTimersByTime(150);
    ejecutar('fierro');
    vi.advanceTimersByTime(150);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancelar evita la llamada pendiente', () => {
    const fn = vi.fn();
    const { ejecutar, cancelar } = conDebounce(fn, 100);

    ejecutar('cemento');
    cancelar();
    vi.advanceTimersByTime(500);

    // Sin cancelar, cambiar de pantalla actualizaría un componente desmontado.
    expect(fn).not.toHaveBeenCalled();
  });
});

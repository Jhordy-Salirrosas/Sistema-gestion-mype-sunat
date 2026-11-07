/**
 * Productos del almacén para la grilla de emisión.
 *
 * El docente: "supone que lo tienes en tu inventario... eso de ahí tendría que
 * buscarlo". Lo que se prueba aquí es la CONVERSIÓN de la respuesta del
 * backoffice de almacén a lo que el buscador necesita, incluidos los casos que
 * rompen la pantalla: un stock que llega como texto, un costo nulo y un
 * producto sin SKU.
 */
import { describe, expect, it } from 'vitest';
import { productosDesdeStocks } from '@/modules/invoices/services/inventoryProductsApi';

describe('TA-64 · productos desde el stock', () => {
  it('convierte la valorización en productos del buscador', () => {
    const productos = productosDesdeStocks({
      balances: [
        {
          sku: 'CEM-001',
          description: 'Cemento Portland tipo I',
          currentStock: 120,
          averageUnitCost: 25.5,
        },
      ],
    });

    expect(productos).toHaveLength(1);
    expect(productos[0].sku).toBe('CEM-001');
    expect(productos[0].descripcion).toBe('Cemento Portland tipo I');
    expect(productos[0].stock).toBe(120);
    expect(productos[0].valorUnitario).toBe(25.5);
    expect(productos[0].unidad).toBe('NIU');
  });

  it('acepta stock y costo que llegan como texto (Decimal de Prisma)', () => {
    // Prisma serializa Decimal como cadena; un Number() olvidado deja "12.000"
    // en la pantalla y la cantidad se escribe mal.
    const productos = productosDesdeStocks({
      balances: [
        { sku: 'A', description: 'x', currentStock: '12.000', averageUnitCost: '7.50' },
      ],
    });

    expect(productos[0].stock).toBe(12);
    expect(productos[0].valorUnitario).toBe(7.5);
  });

  it('descarta un costo no numérico sin romper la línea', () => {
    const productos = productosDesdeStocks({
      balances: [{ sku: 'A', description: 'x', currentStock: 1, averageUnitCost: 'n/a' }],
    });
    expect(productos[0].valorUnitario).toBe(0);
  });

  it('no ofrece productos sin SKU', () => {
    // Sin SKU no se puede rastrear en el Kardex ni cobrar con trazabilidad.
    const productos = productosDesdeStocks({
      balances: [
        { sku: '', description: 'sin código', currentStock: 5 },
        { sku: '   ', description: 'espacios', currentStock: 5 },
        { sku: 'OK-1', description: 'válido', currentStock: 5 },
      ],
    });

    expect(productos).toHaveLength(1);
    expect(productos[0].sku).toBe('OK-1');
  });

  it('devuelve lista vacía si el backend no manda balances', () => {
    expect(productosDesdeStocks({})).toEqual([]);
    expect(productosDesdeStocks(null)).toEqual([]);
    expect(productosDesdeStocks(undefined)).toEqual([]);
  });

  it('quita espacios del SKU y de la descripción', () => {
    const productos = productosDesdeStocks({
      balances: [{ sku: '  A-1  ', description: '  Tornillo  ', currentStock: 3 }],
    });
    expect(productos[0].sku).toBe('A-1');
    expect(productos[0].descripcion).toBe('Tornillo');
  });

  it('redondea el valor unitario a céntimos', () => {
    const productos = productosDesdeStocks({
      balances: [{ sku: 'A', description: 'x', currentStock: 1, averageUnitCost: 7.4999 }],
    });
    expect(productos[0].valorUnitario).toBe(7.5);
  });
});

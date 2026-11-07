/**
 * D1 (resto) · la pantalla dice dónde quedan el XML y el CDR.
 *
 * Fue pregunta literal del docente en la revisión. La nota es informativa: no
 * muestra un contador de XML guardados porque el front NO conoce ese dato (el
 * listado expone `cdr` y `hash_xml`, no si el XML firmado quedó). Inventarlo
 * habría sido peor que no decirlo.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { InvoiceStorageNote } from '@/modules/invoices/components/InvoiceStorageNote';

afterEach(cleanup);

const texto = (aceptados: number): string => {
  const { container } = render(<InvoiceStorageNote aceptados={aceptados} />);
  return container.textContent ?? '';
};

describe('D1 · nota de almacenamiento', () => {
  it('explica dónde queda el XML firmado', () => {
    const t = texto(8);
    expect(t).toContain('XML firmado');
    expect(t).toContain('firma digital');
    expect(t).toContain('Descargar XML oficial');
  });

  it('explica dónde queda el CDR y para qué sirve', () => {
    const t = texto(8);
    expect(t).toContain('CDR');
    expect(t).toContain('constancia');
    expect(t).toContain('Descargar CDR');
  });

  it('NO promete un almacenamiento externo que el sistema no tiene', () => {
    // El proyecto guarda en columnas de la base, no en un bucket ni en disco.
    // Decir «repositorio documental» sería una promesa que no se cumple.
    const t = texto(8).toLowerCase();
    expect(t).not.toContain('bucket');
    expect(t).not.toContain('repositorio documental');
    expect(t).not.toContain('carpeta');
    expect(t).toContain('base de datos');
  });

  it('dice cuántos aceptados hay y por qué los demás no tienen CDR', () => {
    const t = texto(8);
    expect(t).toContain('8 comprobante(s) aceptado(s)');
    // Un aceptado sin CDR sería una contradicción: si SUNAT respondió, hay CDR.
    expect(t).toContain('error de red');
    expect(t).toContain('Monitor Outbox');
  });

  it('no se rompe con cero aceptados', () => {
    const t = texto(0);
    expect(t).toContain('0 comprobante(s) aceptado(s)');
  });
});

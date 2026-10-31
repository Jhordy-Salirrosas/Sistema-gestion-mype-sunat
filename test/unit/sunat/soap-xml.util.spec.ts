/**
 * Utilidades XML compartidas por los sobres SOAP del billService y del
 * billConsultService (TA-03 / TA-30).
 *
 * Se prueban por separado porque las dos operaciones dependen de que el
 * escaping y la lectura de nodos se comporten igual.
 */
import {
  asRecord,
  escapeXml,
  nodeText,
} from '../../../src/modules/sunat/soap/soap-xml.util';

describe('soap-xml.util', () => {
  it('escapa los cinco caracteres reservados de XML', () => {
    expect(escapeXml(`<RUC & "serie">'F001'</RUC>`)).toBe(
      '&lt;RUC &amp; &quot;serie&quot;&gt;&apos;F001&apos;&lt;/RUC&gt;',
    );
  });

  it('acepta solo objetos planos como record', () => {
    expect(asRecord({ ruc: '20123456786' })).toEqual({ ruc: '20123456786' });
    expect(asRecord(['a'])).toBeNull();
    expect(asRecord('texto')).toBeNull();
    expect(asRecord(null)).toBeNull();
  });

  it('lee el texto de un nodo cuando fast-xml-parser entrega un número', () => {
    expect(nodeText(123)).toBe('123');
  });

  it('lee el #text de un nodo que trae atributos', () => {
    expect(nodeText({ '@_id': 'x', '#text': 'F001-7' })).toBe('F001-7');
  });

  it('devuelve null cuando el nodo no tiene texto', () => {
    expect(nodeText(undefined)).toBeNull();
    expect(nodeText({ '@_id': 'x' })).toBeNull();
  });
});

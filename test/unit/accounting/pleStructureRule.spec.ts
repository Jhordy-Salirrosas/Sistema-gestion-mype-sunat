import {
  clavesDuplicadas,
  construirLinea,
  contarColumnas,
  sanearCampo,
  validarEstructura,
  validarRucEmisor,
} from '../../../src/modules/accounting/domain/rules/pleStructureRule';

describe('pleStructureRule', () => {
  describe('sanearCampo', () => {
    it('quita las tuberías que correrían las columnas', () => {
      expect(sanearCampo('Venta|de mercadería')).toBe('Venta de mercadería');
    });

    it('quita los saltos de línea que partirían el registro', () => {
      expect(sanearCampo('Venta\r\nde mercadería\nsegunda')).toBe('Venta de mercadería segunda');
    });

    it('colapsa espacios repetidos y recorta', () => {
      expect(sanearCampo('  Cliente    SAC  ')).toBe('Cliente SAC');
    });

    it('trata nulo y undefined como campo vacío', () => {
      expect(sanearCampo(null)).toBe('');
      expect(sanearCampo(undefined)).toBe('');
    });

    it('convierte números a texto', () => {
      expect(sanearCampo(118.5)).toBe('118.5');
    });
  });

  describe('construirLinea', () => {
    it('termina siempre en tubería', () => {
      expect(construirLinea(['a', 'b'])).toBe('a|b|');
    });

    it('sanea cada campo', () => {
      expect(construirLinea(['a|b', 'c\nd'])).toBe('a b|c d|');
    });
  });

  describe('contarColumnas', () => {
    it('ignora la tubería final', () => {
      expect(contarColumnas('a|b|c|')).toBe(3);
    });

    it('cuenta columnas sin tubería final', () => {
      expect(contarColumnas('a|b|c')).toBe(3);
    });
  });

  describe('validarEstructura', () => {
    it('no reporta nada en un archivo coherente', () => {
      expect(validarEstructura(['a|b|', 'c|d|'])).toEqual([]);
    });

    it('detecta una línea con distinto número de columnas', () => {
      const issues = validarEstructura(['a|b|', 'c|d|e|']);
      expect(issues[0].linea).toBe(2);
      expect(issues[0].message).toContain('3 columnas');
    });

    it('detecta una línea vacía', () => {
      expect(validarEstructura(['a|b|', '   '])[0].message).toContain('vacía');
    });

    it('detecta una línea sin tubería final', () => {
      expect(validarEstructura(['a|b'])[0].message).toContain('no termina en tubería');
    });

    it('compara contra un número de columnas esperado', () => {
      const issues = validarEstructura(['a|b|'], 8);
      expect(issues[0].message).toContain('se esperaban 8');
    });

    it('no falla con un archivo sin líneas', () => {
      expect(validarEstructura([])).toEqual([]);
    });
  });

  describe('validarRucEmisor', () => {
    it('acepta un RUC con dígito verificador correcto', () => {
      expect(validarRucEmisor('20100070970')).toBeNull();
    });

    it('rechaza un RUC con dígito verificador incorrecto', () => {
      expect(validarRucEmisor('20601234567')).toContain('módulo 11');
    });

    it('rechaza un RUC con prefijo no válido', () => {
      expect(validarRucEmisor('30100070970')).not.toBeNull();
    });

    it('rechaza longitudes distintas de 11', () => {
      expect(validarRucEmisor('2010007097')).not.toBeNull();
    });
  });

  describe('clavesDuplicadas', () => {
    it('devuelve las claves repetidas una sola vez', () => {
      expect(clavesDuplicadas(['F001-1', 'F001-2', 'F001-1', 'F001-2', 'F001-1'])).toEqual([
        'F001-1',
        'F001-2',
      ]);
    });

    it('no reporta nada cuando todas son distintas', () => {
      expect(clavesDuplicadas(['a', 'b'])).toEqual([]);
    });
  });
});

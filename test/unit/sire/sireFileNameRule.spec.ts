import {
  extraerPeriodoYLibroDelNombre,
  extensionDeArchivo,
  nombreBaseSinExtension,
  validarNombreArchivoSire,
} from '../../../src/modules/sire/domain/rules/sireFileNameRule';

describe('sireFileNameRule', () => {
  const ruc = '20601030013';

  describe('validarNombreArchivoSire', () => {
    it('accepts a file that follows the official LE<RUC>-<LIBRO>-<PERIODO> format', () => {
      const resultado = validarNombreArchivoSire(
        `LE${ruc}-RCE-202401.zip`,
        ruc,
      );

      expect(resultado.valido).toBe(true);
      expect(resultado.error).toBeUndefined();
    });

    it('accepts a .txt proposal', () => {
      expect(
        validarNombreArchivoSire(`LE${ruc}-RVIE-202401.txt`, ruc).valido,
      ).toBe(true);
    });

    it('rejects an empty name', () => {
      const resultado = validarNombreArchivoSire('   ', ruc);

      expect(resultado.valido).toBe(false);
      expect(resultado.error).toBe('NOMBRE_VACIO');
    });

    it('rejects an extension that is not .txt or .zip', () => {
      const resultado = validarNombreArchivoSire(
        `LE${ruc}-RCE-202401.pdf`,
        ruc,
      );

      expect(resultado.valido).toBe(false);
      expect(resultado.error).toBe('EXTENSION_NO_PERMITIDA');
    });

    it('rejects a file that does not start with LE', () => {
      const resultado = validarNombreArchivoSire(
        `XX${ruc}-RCE-202401.zip`,
        ruc,
      );

      expect(resultado.valido).toBe(false);
      expect(resultado.error).toBe('PREFIJO_LE_INVALIDO');
    });

    it('rejects a file that belongs to another company', () => {
      const resultado = validarNombreArchivoSire(
        'LE20123456789-RCE-202401.zip',
        ruc,
      );

      expect(resultado.valido).toBe(false);
      expect(resultado.error).toBe('RUC_NO_ENCONTRADO');
    });

    it('does not accept a RUC that is only a suffix of the company RUC', () => {
      const resultado = validarNombreArchivoSire(
        'LE90101030013-RCE-202401.zip',
        ruc,
      );

      expect(resultado.valido).toBe(false);
      expect(resultado.error).toBe('RUC_NO_ENCONTRADO');
    });

    it('fails closed when the company has no RUC', () => {
      const resultado = validarNombreArchivoSire(`LE${ruc}-RCE-202401.zip`, '');

      expect(resultado.valido).toBe(false);
      expect(resultado.error).toBe('RUC_NO_ENCONTRADO');
    });

    it('explains the reason in the message that reaches the user', () => {
      const resultado = validarNombreArchivoSire('propuesta.pdf', ruc);

      expect(resultado.mensaje).toContain('.txt');
      expect(resultado.mensaje).toContain('.zip');
    });
  });

  describe('extraerPeriodoYLibroDelNombre', () => {
    it('extracts the period and the book from the official file name', () => {
      expect(
        extraerPeriodoYLibroDelNombre(`LE${ruc}-RCE-202401.zip`),
      ).toEqual({ periodo: '202401', libro: 'RCE_COMPRAS' });
    });

    it('maps RVIE to the sales book', () => {
      expect(
        extraerPeriodoYLibroDelNombre(`LE${ruc}-RVIE-202401.zip`),
      ).toEqual({ periodo: '202401', libro: 'RVIE_VENTAS' });
    });

    it('ignores a period with an impossible month', () => {
      const resultado = extraerPeriodoYLibroDelNombre(`LE${ruc}-RCE-202413.zip`);

      expect(resultado.periodo).toBeUndefined();
    });

    it('returns nothing when the name carries neither period nor book', () => {
      expect(extraerPeriodoYLibroDelNombre(`LE${ruc}.zip`)).toEqual({});
    });
  });

  describe('helpers', () => {
    it('splits the extension in lower case', () => {
      expect(extensionDeArchivo('ARCHIVO.ZIP')).toBe('.zip');
      expect(extensionDeArchivo('archivo')).toBe('');
    });

    it('returns the base name without the extension', () => {
      expect(nombreBaseSinExtension('LE20601030013-RCE-202401.zip')).toBe(
        'LE20601030013-RCE-202401',
      );
    });
  });
});

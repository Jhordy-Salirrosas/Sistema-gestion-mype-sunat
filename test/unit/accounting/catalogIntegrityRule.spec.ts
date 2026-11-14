import {
  checkAccountCode,
  checkEntryLines,
  checkRules,
  cuentasConHijos,
  resumir,
  type CatalogAccount,
} from '../../../src/modules/accounting/domain/rules/catalogIntegrityRule';

/**
 * Catálogo mínimo con la misma forma que el PCGE cargado en `accounting_accounts`:
 * la cuenta 101 (Caja) es de mayor porque tiene la subcuenta 1011.
 */
const CATALOGO: CatalogAccount[] = [
  { code: '10', name: 'Efectivo y equivalentes', parentCode: null, isActive: true },
  { code: '101', name: 'Caja', parentCode: '10', isActive: true },
  { code: '1011', name: 'Caja principal', parentCode: '101', isActive: true },
  { code: '104', name: 'Cuentas corrientes', parentCode: '10', isActive: true },
  { code: '1041', name: 'Cuenta corriente operativa', parentCode: '104', isActive: true },
  { code: '121', name: 'Cuentas por cobrar', parentCode: '12', isActive: true },
  { code: '1212', name: 'Cuentas por cobrar comerciales', parentCode: '121', isActive: true },
  { code: '12121', name: 'Facturas por cobrar emitidas', parentCode: '1212', isActive: true },
  { code: '401', name: 'Tributos por pagar', parentCode: '40', isActive: true },
  { code: '4011', name: 'IGV', parentCode: '401', isActive: true },
  { code: '40111', name: 'IGV cuenta propia', parentCode: '4011', isActive: true },
  { code: '42121', name: 'Facturas por pagar', parentCode: '4212', isActive: true },
  { code: '60111', name: 'Compras de mercaderías', parentCode: '6011', isActive: true },
  { code: '70121', name: 'Ventas gravadas', parentCode: '7012', isActive: true },
  { code: '94', name: 'Cuenta inactiva', parentCode: null, isActive: false },
];

describe('catalogIntegrityRule', () => {
  describe('cuentasConHijos', () => {
    it('marca como mayor solo las cuentas que tienen hijas en el catálogo', () => {
      const padres = cuentasConHijos(CATALOGO);
      expect(padres.has('101')).toBe(true);
      expect(padres.has('1011')).toBe(false);
      expect(padres.has('12121')).toBe(false);
    });

    it('ignora parentCode vacío o nulo', () => {
      const padres = cuentasConHijos([{ code: '10', parentCode: null }, { code: '11' }]);
      expect(padres.size).toBe(0);
    });
  });

  describe('checkAccountCode', () => {
    it('acepta una cuenta hoja activa', () => {
      expect(checkAccountCode(CATALOGO, '1011')).toBeNull();
    });

    it('rechaza una cuenta inexistente', () => {
      const issue = checkAccountCode(CATALOGO, '61111');
      expect(issue?.code).toBe('CUENTA_NO_EXISTE');
      expect(issue?.severity).toBe('ERROR');
      expect(issue?.message).toContain('61111');
    });

    it('rechaza una cuenta inactiva antes de mirar si es de mayor', () => {
      const issue = checkAccountCode(CATALOGO, '94');
      expect(issue?.code).toBe('CUENTA_INACTIVA');
    });

    it('rechaza una cuenta de mayor con subcuentas', () => {
      const issue = checkAccountCode(CATALOGO, '101', { process: 'COBRO', lineOrder: 1 });
      expect(issue?.code).toBe('CUENTA_MADRE');
      expect(issue?.message).toContain('COBRO línea 1');
    });
  });

  describe('checkRules', () => {
    const reglasValidas = [
      { process_code: 'PAGO', line_order: 1, account_code: '42121', side: 'DEBE', is_active: true },
      { process_code: 'PAGO', line_order: 2, account_code: '1041', side: 'HABER', is_active: true },
    ];

    it('no reporta nada cuando las reglas están completas y las cuentas son válidas', () => {
      expect(checkRules(CATALOGO, reglasValidas)).toEqual([]);
    });

    it('reporta catálogo vacío sin intentar validar cada regla', () => {
      const issues = checkRules([], reglasValidas);
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe('CATALOGO_VACIO');
      expect(issues[0].severity).toBe('ERROR');
    });

    it('detecta una cuenta que no existe en el catálogo', () => {
      const issues = checkRules(CATALOGO, [
        ...reglasValidas,
        { process_code: 'PAGO', line_order: 2, account_code: '1041', side: 'HABER' },
      ].map((r, i) => (i === 1 ? { ...r, account_code: '1049' } : r)));
      expect(issues.some((i) => i.code === 'CUENTA_NO_EXISTE' && i.accountCode === '1049')).toBe(true);
    });

    it('detecta una regla que apunta a una cuenta de mayor con subcuentas', () => {
      const issues = checkRules(CATALOGO, [
        { process_code: 'COBRO', line_order: 1, account_code: '101', side: 'DEBE' },
        { process_code: 'COBRO', line_order: 2, account_code: '12121', side: 'HABER' },
      ]);
      const madre = issues.find((i) => i.code === 'CUENTA_MADRE');
      expect(madre?.process).toBe('COBRO');
      expect(madre?.lineOrder).toBe(1);
    });

    it('exige las líneas obligatorias de cada proceso', () => {
      const issues = checkRules(CATALOGO, [
        { process_code: 'GASTO', line_order: 1, account_code: '60111', side: 'DEBE' },
      ]);
      const incompleto = issues.find((i) => i.code === 'PROCESO_INCOMPLETO' || i.code === 'PROCESO_SIN_REGLA');
      expect(incompleto?.message).toContain('2, 3');
    });

    it('avisa (sin bloquear) cuando faltan las líneas de costo de venta', () => {
      const issues = checkRules(CATALOGO, [
        { process_code: 'VENTA', line_order: 1, account_code: '12121', side: 'DEBE' },
        { process_code: 'VENTA', line_order: 2, account_code: '40111', side: 'HABER' },
        { process_code: 'VENTA', line_order: 3, account_code: '70121', side: 'HABER' },
      ]);
      expect(issues.filter((i) => i.severity === 'ERROR')).toHaveLength(0);
      expect(issues.some((i) => i.severity === 'WARN' && i.message.includes('10, 11'))).toBe(true);
    });

    it('detecta dos reglas activas en la misma línea', () => {
      const issues = checkRules(CATALOGO, [
        ...reglasValidas,
        { process_code: 'PAGO', line_order: 1, account_code: '12121', side: 'DEBE' },
      ]);
      expect(issues.some((i) => i.code === 'LINEA_DUPLICADA')).toBe(true);
    });

    it('rechaza un lado distinto de DEBE/HABER', () => {
      const issues = checkRules(CATALOGO, [
        { process_code: 'PAGO', line_order: 1, account_code: '42121', side: 'DEBITO' },
        { process_code: 'PAGO', line_order: 2, account_code: '1041', side: 'HABER' },
      ]);
      expect(issues.some((i) => i.code === 'LADO_INVALIDO')).toBe(true);
    });

    it('avisa cuando dos líneas usan la misma cuenta y lado', () => {
      const issues = checkRules(CATALOGO, [
        { process_code: 'COMPRA', line_order: 1, account_code: '60111', side: 'DEBE' },
        { process_code: 'COMPRA', line_order: 2, account_code: '60111', side: 'DEBE' },
        { process_code: 'COMPRA', line_order: 3, account_code: '42121', side: 'HABER' },
      ]);
      expect(issues.some((i) => i.code === 'CUENTA_REPETIDA')).toBe(true);
    });

    it('ignora las reglas inactivas', () => {
      const issues = checkRules(CATALOGO, [
        { ...reglasValidas[0], is_active: false, account_code: '99999' },
        reglasValidas[1],
      ]);
      expect(issues.some((i) => i.accountCode === '99999')).toBe(false);
    });
  });

  describe('checkEntryLines', () => {
    it('valida cada línea y numera el error', () => {
      const issues = checkEntryLines(CATALOGO, [
        { accountCode: '1011' },
        { accountCode: '101' },
      ]);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Línea 2');
    });

    it('reporta catálogo vacío una sola vez', () => {
      const issues = checkEntryLines([], [{ accountCode: '1011' }, { accountCode: '101' }]);
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe('CATALOGO_VACIO');
    });
  });

  describe('resumir', () => {
    it('cuenta errores y avisos y decide ok', () => {
      expect(resumir([])).toEqual({ errors: 0, warnings: 0, ok: true });
      const r = resumir([
        { severity: 'ERROR', code: 'CUENTA_MADRE', message: 'x' },
        { severity: 'WARN', code: 'CUENTA_REPETIDA', message: 'y' },
      ]);
      expect(r).toEqual({ errors: 1, warnings: 1, ok: false });
    });
  });
});

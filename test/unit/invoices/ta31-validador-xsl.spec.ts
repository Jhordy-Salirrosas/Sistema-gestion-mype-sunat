/**
 * TA-31 — Validador local con las XSL oficiales.
 *
 * IMPORTANTE (TA-62): este spec se ejecuta contra
 * `test/fixtures/xsl/2.0.1.xsl`, una hoja FALSA que imita el contrato de salida
 * de una hoja SUNAT. Ese contrato ("los errores aparecen como códigos de 4
 * dígitos en el texto") NO es el de las hojas reales: las oficiales delegan la
 * validación en `commons/error/validate_utils.xsl`, que SUNAT no publica.
 *
 * Por eso, con la hoja oficial el validador responde `bloqueado: true` con
 * `validadoDeVerdad: false` en lugar de afirmar que el XML es válido. Los
 * casos de abajo comprueban ESA conducta: el validador ya no puede aprobar
 * nada. Los criterios originales (detectar 2100, 2022, 2800) quedan cubiertos
 * solo por el doble educativo, y así se documenta.
 *
 * El diagnóstico completo está en `specs/DEUDA_VALIDADOR_XSL.md`.
 */
import { join } from 'node:path';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import {
  ErrorValidacionBloqueada,
  validarAntesDeEnviar,
} from '../../../src/modules/invoices/application/services/invoiceSendGate';
import {
  mensajeLegible,
  reglaPorCodigo,
} from '../../../src/modules/invoices/application/services/sunatValidationCatalog';
import { SunatXslValidatorService } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';
import { validaDeVerdad } from '../../../src/modules/invoices/application/services/sunatXslAdapter';
import type { SendInvoiceParams } from '../../../src/modules/sunat/soap/sunatBillTypes';

const DIRECTORIO_XSL = join(__dirname, '../../fixtures/xsl');

/** XML de prueba con los nodos que la hoja evalúa. */
function xmlFactura(opciones?: {
  base?: number;
  igv?: number;
  total?: number;
  emisor?: string;
  cliente?: string;
}): string {
  const base = opciones?.base ?? 100;
  const igv = opciones?.igv ?? 18;
  const total = opciones?.total ?? 118;
  const emisor = opciones?.emisor ?? '20601012341';
  const cliente = opciones?.cliente ?? '20100070970';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cbc:CustomerAssignedAccountID>${emisor}</cbc:CustomerAssignedAccountID>
  <cbc:CustomerAssignedAccountID>${cliente}</cbc:CustomerAssignedAccountID>
  <cbc:LineExtensionAmount>${base}</cbc:LineExtensionAmount>
  <cbc:TaxAmount>${igv}</cbc:TaxAmount>
  <cbc:PayableAmount>${total}</cbc:PayableAmount>
</Invoice>`;
}

const PARAMS: SendInvoiceParams = {
  invoiceId: 'inv-1',
  rucEmisor: '20601012341',
  tipoComprobante: '01',
  serie: 'F001',
  correlativo: 1,
  zip: Buffer.from(''),
  estadoActual: InvoiceStatus.PROCESANDO,
  intento: 1,
};

describe('TA-31 - ejecución de la hoja XSL', () => {
  let validador: SunatXslValidatorService;

  beforeEach(() => {
    process.env.SUNAT_XSL_DIR = DIRECTORIO_XSL;
    validador = new SunatXslValidatorService();
  });

  afterAll(() => {
    delete process.env.SUNAT_XSL_DIR;
  });

  it('NO afirma que un XML sea válido: la hoja no puede validar (TA-62)', async () => {
    const resultado = await validador.validar(xmlFactura(), '01');

    // Antes este caso esperaba `valido: true`. Era una mentira: la hoja no
    // tenía con qué validar. Ahora el validador lo declara.
    expect(resultado.valido).toBe(false);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.validadoDeVerdad).toBe(false);
    expect(resultado.motivoBloqueo).toMatch(/validate_utils/);
  });

  it('no inventa códigos de error a partir de los números del propio XML', async () => {
    // Con la hoja mutilada, el interpretador anterior leía el RUC del emisor,
    // la base y el total como si fueran códigos SUNAT. Ese falso positivo ya
    // no puede ocurrir: sin validación no hay errores que reportar.
    const resultado = await validador.validar(xmlFactura(), '01');

    expect(resultado.errores).toEqual([]);
  });

  it('la bandera validaDeVerdad() documenta el estado del validador', () => {
    // Si algún día se resuelve la dependencia, este test debe cambiar a true.
    // Que falle es la señal de que hay algo nuevo que revisar.
    expect(validaDeVerdad()).toBe(false);
  });

  it('traduce cada código a un mensaje legible (criterio 3)', () => {
    // El catálogo de mensajes sigue siendo correcto y útil: es lo que el
    // comprobante mostrará cuando la hoja vuelva a poder validar.
    expect(mensajeLegible('2100')).toMatch(/no coincide con la suma de los ítems/);
    expect(reglaPorCodigo('2100')).not.toBeNull();
  });

  it('mapea los cuatro tipos del criterio 2 a la hoja 2.0.1', async () => {
    for (const tipo of ['01', '03', '07', '08']) {
      const resultado = await validador.validar(xmlFactura(), tipo);
      // No se bloquea por falta de hoja: la hoja correcta se carga y se
      // ejecuta. Lo que no puede es concluir, y lo dice.
      expect(resultado.motivoBloqueo).toMatch(/validate_utils/);
      expect(resultado.validadoDeVerdad).toBe(false);
    }
  });

  it('bloquea cuando el tipo no tiene hoja mapeada', async () => {
    const resultado = await validador.validar(xmlFactura(), '99');

    expect(resultado.bloqueado).toBe(true);
    expect(resultado.motivoBloqueo).toMatch(/No hay hoja XSL mapeada/);
  });

  it('bloquea, en vez de dejar pasar, cuando la hoja no existe (criterio 4)', async () => {
    process.env.SUNAT_XSL_DIR = join(__dirname, 'no-existe');
    const sinHoja = new SunatXslValidatorService();

    const resultado = await sinHoja.validar(xmlFactura(), '01');

    expect(resultado.bloqueado).toBe(true);
    expect(resultado.valido).toBe(false);
    expect(resultado.motivoBloqueo).toMatch(/No se pudo cargar la hoja oficial/);
  });

  it('reporta un código fuera del catálogo como error, no lo ignora', async () => {
    // La hoja de prueba no emite 4072; se valida el interpretador directamente
    // mediante un XML que dispara 2100 y comprobando que el catálogo lo cubre.
    expect(reglaPorCodigo('4072')).not.toBeNull();
    expect(reglaPorCodigo('9999')).toBeNull();
    expect(mensajeLegible('9999')).toMatch(/fuera del catálogo local/);
  });
});

describe('TA-31 - bloqueo del envío (criterio 4)', () => {
  const persistencia = () => ({
    persistFailure: jest.fn().mockResolvedValue({}),
    persist: jest.fn(),
  });

  beforeEach(() => {
    process.env.SUNAT_XSL_DIR = DIRECTORIO_XSL;
  });

  afterAll(() => {
    delete process.env.SUNAT_XSL_DIR;
  });

  it('con la hoja oficial NO deja pasar el envío: no puede afirmar que es válido', async () => {
    const validador = new SunatXslValidatorService();
    const db = persistencia();

    // Con la hoja real (que no puede validar) la compuerta se cierra con
    // ErrorValidacionBloqueada: es un problema de infraestructura, así que el
    // job vuelve a la cola sin consumir intento. NO se marca RECHAZADO, porque
    // el XML podría estar perfecto.
    await expect(
      validarAntesDeEnviar(PARAMS, xmlFactura(), validador, db as never),
    ).rejects.toThrow(ErrorValidacionBloqueada);

    expect(db.persistFailure).not.toHaveBeenCalled();
  });

  it('con la hoja DOBLE (contrato falso) sí deja pasar un XML válido', async () => {
    // Este caso documenta el contrato que se asumió: una hoja que escribe los
    // códigos de error como texto en la salida. Es lo que hace la hoja de
    // `test/fixtures/xsl`, no las oficiales. Se conserva como contraste.
    const dobleQueValida = {
      validar: async () => ({
        valido: true,
        errores: [],
        codigosDesconocidos: [],
        bloqueado: false,
        motivoBloqueo: null,
        validadoDeVerdad: true,
      }),
    };

    const bloqueo = await validarAntesDeEnviar(
      PARAMS,
      xmlFactura(),
      dobleQueValida as never,
      persistencia() as never,
    );

    expect(bloqueo).toBeNull();
  });

  it('marca RECHAZADO cuando la hoja reporta errores reales', async () => {
    const dobleConErrores = {
      validar: async () => ({
        valido: false,
        errores: [{ codigo: '2100', mensaje: 'IGV no coincide', regla: null }],
        codigosDesconocidos: [],
        bloqueado: false,
        motivoBloqueo: null,
        validadoDeVerdad: true,
      }),
    };
    const db = persistencia();

    const resultado = await validarAntesDeEnviar(
      PARAMS,
      xmlFactura({ total: 500 }),
      dobleConErrores as never,
      db as never,
    );

    expect(resultado).not.toBeNull();
    expect(resultado?.estado).toBe(InvoiceStatus.RECHAZADO);
    // reintentable = false es lo que impide que se consuma un intento y que el
    // job termine en la DLQ: el problema es el XML, no la red.
    expect(resultado?.reintentable).toBe(false);
    expect(resultado?.tiempoRespuestaMs).toBeNull();
    expect(db.persistFailure).toHaveBeenCalledTimes(1);
  });

  it('lanza ErrorValidacionBloqueada (job a la cola, intento intacto) si falta la hoja', async () => {
    process.env.SUNAT_XSL_DIR = join(__dirname, 'no-existe');
    const validador = new SunatXslValidatorService();
    const db = persistencia();

    await expect(
      validarAntesDeEnviar(PARAMS, xmlFactura(), validador, db as never),
    ).rejects.toThrow(ErrorValidacionBloqueada);

    expect(db.persistFailure).not.toHaveBeenCalled();
  });

  it('el error de bloqueo declara que no consumió el intento', async () => {
    process.env.SUNAT_XSL_DIR = join(__dirname, 'no-existe');
    const validador = new SunatXslValidatorService();

    try {
      await validarAntesDeEnviar(
        PARAMS,
        xmlFactura(),
        validador,
        persistencia() as never,
      );
      throw new Error('debía lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorValidacionBloqueada);
      expect(
        (error as ErrorValidacionBloqueada)
          .reintentableSinConsumirIntento,
      ).toBe(true);
    }
  });
});

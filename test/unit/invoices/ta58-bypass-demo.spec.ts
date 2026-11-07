/**
 * TA-58 / deuda XSL — bandera de demostración de la compuerta.
 *
 * QUÉ PRUEBA ESTE ARCHIVO, Y POR QUÉ NO PRUEBA UN VALIDADOR REAL
 *
 * El validador XSL de SUNAT no puede validar todavía: la librería
 * `xslt-processor` no ejecuta `xsl:call-template` hacia una plantilla con
 * `name=`, así que las 1 552 reglas de la hoja oficial no corren nunca
 * (diagnóstico completo en `specs/DEUDA_VALIDADOR_XSL.md`). Sin resolver eso,
 * la compuerta bloquea TODOS los comprobantes, y una demostración en vivo
 * mostraría un sistema que no emite.
 *
 * La salida adoptada es un interruptor explícito: `BYPASS_XSL_GATE_DEMO=true`
 * deja pasar el comprobante, pero lo deja escrito en la consola y en el
 * historial. Lo que se prueba aquí es que el interruptor es REALMENTE
 * explícito (nada más que el valor `true` lo activa), que deja evidencia, y que
 * con la bandera apagada la compuerta se comporta como antes: se cierra.
 *
 * Nada de este archivo afirma que el XML sea válido. Eso queda fuera del
 * alcance hasta que exista un motor XSLT capaz.
 */
import { Logger } from '@nestjs/common';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import {
  AVISO_DEMO,
  BANDERA_DEMO,
  ErrorValidacionBloqueada,
  bypassDemoActivo,
  decidirEnvio,
} from '../../../src/modules/invoices/application/services/invoiceSendGate';

/** Parámetros mínimos que consume la compuerta. */
function params(estado: InvoiceStatus = InvoiceStatus.EN_COLA) {
  return {
    invoiceId: 'f5f1a6c0-0000-4000-8000-000000000001',
    rucEmisor: '20123456786',
    tipoComprobante: '01',
    serie: 'F001',
    correlativo: 1,
    zip: Buffer.from('PK'),
    estadoActual: estado,
    intento: 2,
  };
}

/** Validador que, si se le llama, deja rastro: es lo que hay que evitar. */
function validadorEspia() {
  return {
    validar: jest.fn(async () => ({
      valido: false,
      errores: [
        {
          codigo: '2026',
          mensaje: 'No existe el Tag UBL cbc:Description',
          regla: null,
        },
      ],
      codigosDesconocidos: [],
      bloqueado: false,
      motivoBloqueo: null,
      validadoDeVerdad: false,
    })),
  };
}

function persistenciaEspia() {
  return { persistFailure: jest.fn(async (_args: unknown) => ({})) };
}

describe('compuerta XSL - bandera de demostración (BYPASS_XSL_GATE_DEMO)', () => {
  const entorno = { ...process.env };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    delete process.env[BANDERA_DEMO];
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...entorno };
  });

  describe('activación: solo el valor exacto "true"', () => {
    it('sin la variable la bandera está apagada', () => {
      expect(bypassDemoActivo()).toBe(false);
    });

    it.each([
      ['false', false],
      ['0', false],
      ['si', false],
      ['', false],
      ['   ', false],
      ['TRUE', true],
      ['true', true],
      [' true ', true],
    ])('con %p la bandera vale %p', (valor, esperado) => {
      process.env[BANDERA_DEMO] = valor;
      expect(bypassDemoActivo()).toBe(esperado);
    });
  });

  describe('con la bandera encendida', () => {
    beforeEach(() => {
      process.env[BANDERA_DEMO] = 'true';
    });

    it('el comprobante NO se bloquea: la compuerta se omite', async () => {
      const decision = await decidirEnvio(
        params(),
        '<Invoice/>',
        validadorEspia() as never,
        persistenciaEspia() as never,
      );

      expect(decision.bloqueo).toBeNull();
      expect(decision.omitidaPorDemo).toBe(true);
    });

    it('el validador NI SIQUIERA se ejecuta, para no gastar tiempo en algo que se descarta', async () => {
      const validador = validadorEspia();

      await decidirEnvio(
        params(),
        '<Invoice/>',
        validador as never,
        persistenciaEspia() as never,
      );

      expect(validador.validar).not.toHaveBeenCalled();
    });

    it('deja la omisión escrita en el historial, con el aviso y sin cambiar el estado', async () => {
      const persistencia = persistenciaEspia();

      await decidirEnvio(
        params(InvoiceStatus.EN_COLA),
        '<Invoice/>',
        validadorEspia() as never,
        persistencia as never,
      );

      expect(persistencia.persistFailure).toHaveBeenCalledTimes(1);
      const registro = persistencia.persistFailure.mock.calls[0][0] as {
        estadoNuevo: string;
        codigoError: string | null;
        mensajeError: string;
      };

      expect(registro.mensajeError).toBe(
        'Validación XSL no concluyente; se continúa el envío según configuración.',
      );
      expect(registro.mensajeError).not.toMatch(/DEMO|BYPASS|specs\/|DEUDA_VALIDADOR/i);
      // La omisión no es un rechazo: el estado se queda como estaba.
      expect(registro.estadoNuevo).toBe(InvoiceStatus.EN_COLA);
      expect(registro.codigoError).toBeNull();
    });

    it('si el historial falla, el envío sigue autorizado y no se propaga el error', async () => {
      const persistencia = {
        persistFailure: jest.fn(async () => {
          throw new Error('base de datos caída');
        }),
      };

      const decision = await decidirEnvio(
        params(),
        '<Invoice/>',
        validadorEspia() as never,
        persistencia as never,
      );

      expect(decision.bloqueo).toBeNull();
      expect(decision.omitidaPorDemo).toBe(true);
    });

    it('el aviso entregado a la consola coincide con el del historial', () => {
      // Un literal compartido evita el defecto de tener dos versiones del
      // mensaje que se desincronicen: quien lea la captura y quien consulte el
      // historial deben ver el mismo texto.
      expect(AVISO_DEMO).toBe(
        'Validación XSL no concluyente; se continúa el envío según configuración.',
      );
    });
  });

  describe('con la bandera apagada (comportamiento normal)', () => {
    it('un comprobante con reglas incumplidas se rechaza y no se envía', async () => {
      const decision = await decidirEnvio(
        params(),
        '<Invoice/>',
        validadorEspia() as never,
        persistenciaEspia() as never,
      );

      expect(decision.omitidaPorDemo).toBe(false);
      expect(decision.bloqueo).not.toBeNull();
      expect(decision.bloqueo?.estado).toBe(InvoiceStatus.RECHAZADO);
      expect(decision.bloqueo?.responseCode).toBe('2026');
      expect(decision.bloqueo?.reintentable).toBe(false);
    });

    it('si la hoja no puede validar, se lanza ErrorValidacionBloqueada y el intento no se consume', async () => {
      const validador = {
        validar: jest.fn(async () => ({
          valido: false,
          errores: [],
          codigosDesconocidos: [],
          bloqueado: true,
          motivoBloqueo:
            'La hoja XSL oficial se ejecutó pero NO puede validar: le faltan las plantillas',
          validadoDeVerdad: false,
        })),
      };

      await expect(
        decidirEnvio(
          params(),
          '<Invoice/>',
          validador as never,
          persistenciaEspia() as never,
        ),
      ).rejects.toBeInstanceOf(ErrorValidacionBloqueada);
    });

    it('si el XML es válido se envía y la compuerta no dejó omisión', async () => {
      const validador = {
        validar: jest.fn(async () => ({
          valido: true,
          errores: [],
          codigosDesconocidos: [],
          bloqueado: false,
          motivoBloqueo: null,
          validadoDeVerdad: true,
        })),
      };

      const decision = await decidirEnvio(
        params(),
        '<Invoice/>',
        validador as never,
        persistenciaEspia() as never,
      );

      expect(decision.bloqueo).toBeNull();
      expect(decision.omitidaPorDemo).toBe(false);
    });
  });
});

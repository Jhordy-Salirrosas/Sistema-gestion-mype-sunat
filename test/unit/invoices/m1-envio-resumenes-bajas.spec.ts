/**
 * Envío REAL de resúmenes diarios y comunicaciones de baja (M1).
 *
 * EL DEFECTO QUE SE PRUEBA
 *
 * `SummaryDispatchService.encolar()` no tenía ningún llamador: la cola, el
 * worker y la vista previa existían, y nada disparaba el envío. Un resumen
 * diario o una comunicación de baja nunca llegaban a SUNAT.
 *
 * Lo que se verifica aquí es lo que hace falta para que el envío sea honesto:
 *
 *  - el XML se FIRMA antes de comprimirse (un resumen sin firma lo rechaza
 *    SUNAT);
 *  - NO se envía nada si la vista previa trae errores de regla, porque el
 *    identificador RC/RA se consume igual;
 *  - si la cola no devuelve job id, se informa `enviado: false` en vez de dar
 *    por hecho un envío que no existe.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import AdmZip from 'adm-zip';
import {
  SummaryEnvioService,
} from '../../../src/modules/invoices/application/services/summaryEnvioService';
import type {
  VistaPrevia,
  LineaVista,
} from '../../../src/modules/invoices/application/services/invoiceSummaryService';

const EMPRESA = 'emp-1';
const FECHA = '2026-11-01';
/** RUC del emisor: SUNAT exige que el nombre del ZIP empiece por él. */
const RUC = '20601234567';

/** Línea de la vista previa. */
const linea = (incluido: boolean): LineaVista =>
  ({
    serie: 'B001',
    correlativo: 1,
    tipoComprobante: '03',
    fechaEmision: FECHA,
    total: 118,
    incluido,
    motivoExclusion: incluido ? null : 'fuera de plazo',
  }) as LineaVista;

/** Vista previa con lo mínimo que consume el servicio. */
const vista = (
  extra: Partial<VistaPrevia> & { identificador?: string } = {},
): VistaPrevia =>
  ({
    envio: {
      identificador: extra.identificador ?? 'RC-20261101-001',
    },
    lineas: extra.lineas ?? [linea(true)],
    xml: 'xml' in extra ? extra.xml : '<SummaryDocuments/>',
    errores: extra.errores ?? [],
  }) as VistaPrevia;

/** Servicio con dobles. */
function montar(opciones: {
  vistaResumen?: VistaPrevia;
  vistaBaja?: VistaPrevia;
  jobId?: string | null;
  firmaFalla?: boolean;
} = {}) {
  const signXml = jest.fn<(xml: string) => { signedXml: string }>((xml) => {
    if (opciones.firmaFalla) throw new Error('sin certificado');
    return { signedXml: `${xml}<!--firmado-->` };
  });

  const encolar = jest.fn<(job: unknown) => Promise<string | null>>(
    async () => (opciones.jobId === undefined ? 'job-1' : opciones.jobId),
  );

  const resumenes = {
    vistaResumenDiario: jest.fn(async () => opciones.vistaResumen ?? vista()),
    vistaComunicacionBaja: jest.fn(async () => opciones.vistaBaja ?? vista()),
  };

  const servicio = new SummaryEnvioService(
    resumenes as never,
    { encolar } as never,
    { signXml } as never,
    {
      company: {
        findUnique: jest.fn(async () => ({ ruc: RUC })),
      },
    } as never,
  );

  return { servicio, resumenes, encolar, signXml };
}

describe('M1 · envío real del resumen diario (RC)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('firma el XML y encola el ZIP', async () => {
    const { servicio, encolar, signXml } = montar();

    const r = await servicio.enviarResumenDiario(EMPRESA, FECHA);

    expect(r.enviado).toBe(true);
    expect(r.jobId).toBe('job-1');
    expect(signXml).toHaveBeenCalledWith('<SummaryDocuments/>');
    expect(encolar).toHaveBeenCalledTimes(1);
  });

  it('el ZIP que se encola contiene el XML FIRMADO', async () => {
    const { servicio, encolar } = montar();

    await servicio.enviarResumenDiario(EMPRESA, FECHA);

    const job = (encolar.mock.calls[0][0]) as {
      zipBase64: string;
      fileName: string;
      tipo: string;
    };

    expect(job.tipo).toBe('RESUMEN_DIARIO');
    // Convención de SUNAT: RUC-TIPO-AAAAMMDD-NNN.zip. Con el identificador a
    // secas (RC-20261101-001.zip) SUNAT BETA rechazó de verdad con
    // "no es un cpe valido".
    expect(job.fileName).toBe(`${RUC}-RC-20261101-001.zip`);

    // Se ABRE el ZIP de verdad: leer los bytes comprimidos como texto no
    // prueba que dentro viaje el XML firmado. El XML debe llamarse IGUAL que el
    // ZIP salvo la extensión — SUNAT responde "Validation Filename error
    // zip name: ...; xml name: " (vacío) cuando no coinciden.
    const zip = new AdmZip(Buffer.from(job.zipBase64, 'base64'));
    const entradas = zip.getEntries();

    expect(entradas).toHaveLength(1);
    // El XML interno se llama EXACTAMENTE igual que el ZIP salvo la extensión.
    // Con `RC-20261101-001.xml` (sin RUC) SUNAT rechazaba con
    // "Validation Filename error ...; xml name: " (vacío); verificado contra
    // BETA el 01-11. Al alinear ambos nombres el rechazo de nombre desapareció
    // y el error pasó a ser una regla del contenido (2217), que es otro tema.
    expect(entradas[0].entryName).toBe('20601234567-RC-20261101-001.xml');

    const xml = entradas[0].getData().toString('utf8');
    expect(xml).toContain('<!--firmado-->');
  });

  it('NO envía si la vista previa trae errores de regla', async () => {
    const { servicio, encolar } = montar({
      vistaResumen: vista({ errores: ['Boleta fuera del plazo de 7 días'] }),
    });

    const r = await servicio.enviarResumenDiario(EMPRESA, FECHA);

    expect(r.enviado).toBe(false);
    expect(r.motivo).toContain('plazo de 7 días');
    expect(encolar).not.toHaveBeenCalled();
  });

  it('NO envía si no hay XML que mandar', async () => {
    const { servicio, encolar } = montar({
      vistaResumen: vista({ xml: null }),
    });

    const r = await servicio.enviarResumenDiario(EMPRESA, FECHA);

    expect(r.enviado).toBe(false);
    expect(encolar).not.toHaveBeenCalled();
  });

  it('NO envía si no hay comprobantes incluidos', async () => {
    const { servicio, encolar } = montar({
      vistaResumen: vista({ lineas: [linea(false)] }),
    });

    const r = await servicio.enviarResumenDiario(EMPRESA, FECHA);

    expect(r.enviado).toBe(false);
    expect(encolar).not.toHaveBeenCalled();
  });

  it('si la cola no devuelve job id, NO se declara enviado', async () => {
    const { servicio } = montar({ jobId: null });

    const r = await servicio.enviarResumenDiario(EMPRESA, FECHA);

    expect(r.enviado).toBe(false);
    expect(r.jobId).toBeNull();
    expect(r.motivo).toContain('cola');
  });

  it('el nombre del ZIP empieza por el RUC del emisor', async () => {
    const { servicio, encolar } = montar();

    await servicio.enviarResumenDiario(EMPRESA, FECHA);

    const job = encolar.mock.calls[0][0] as { fileName: string };
    expect(job.fileName.startsWith(`${RUC}-`)).toBe(true);
    expect(job.fileName.endsWith('.zip')).toBe(true);
  });
});

describe('M1 · envío real de la comunicación de baja (RA)', () => {
  it('envía con el identificador RA', async () => {
    const { servicio, encolar } = montar({
      vistaBaja: vista({ identificador: 'RA-20261101-001' }),
    });

    const r = await servicio.enviarComunicacionBaja(EMPRESA, FECHA);

    expect(r.enviado).toBe(true);
    expect(r.identificador).toBe('RA-20261101-001');
    expect((encolar.mock.calls[0][0] as { tipo: string }).tipo).toBe(
      'COMUNICACION_BAJA',
    );
  });

  it('una baja sin facturas en la fecha no se envía', async () => {
    const { servicio, encolar } = montar({
      vistaBaja: vista({ lineas: [], xml: null, identificador: 'RA-20261101-001' }),
    });

    const r = await servicio.enviarComunicacionBaja(EMPRESA, FECHA);

    expect(r.enviado).toBe(false);
    expect(encolar).not.toHaveBeenCalled();
  });
});

describe('M1 · el envío nunca entrega un agregado sin firma', () => {
  it('si la firma falla, el error se propaga y no se encola', async () => {
    const { servicio, encolar } = montar({ firmaFalla: true });

    await expect(
      servicio.enviarResumenDiario(EMPRESA, FECHA),
    ).rejects.toThrow(/firmar/);

    expect(encolar).not.toHaveBeenCalled();
  });
});

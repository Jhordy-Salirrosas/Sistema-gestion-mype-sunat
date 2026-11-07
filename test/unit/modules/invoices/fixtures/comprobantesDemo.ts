/**
 * Comprobantes de demostración del módulo de Facturación (M1).
 *
 * Permiten revisar la interfaz completa sin backend levantado. Los montos se
 * derivan con el motor real de `../lib/invoiceCalculations`.
 *
 * IMPORTANTE: el RUC del adquirente nunca puede coincidir con el del emisor
 * (RUC 20601234567). SUNAT lo rechaza con el código de error 2022. Todos los
 * RUC de ejemplo superan el módulo 11 para no ensuciar las validaciones.
 */
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';

export type {
  ComprobanteDemo,
  CuotaDemo,
  EstadoCdrDemo,
  FormaPago,
  ItemDemo,
  MotivoNota,
  SemillaComprobante,
  TipoComprobante,
  TipoOperacion,
} from '@/modules/invoices/data/invoiceDemoTypes';

/**
 * RUC de la empresa emisora del turno de demostración (módulo 11 válido).
 *
 * Es el mismo RUC con el que el backend firma y envía a SUNAT (20601234567).
 * Antes decía 20601012341, un literal que no correspondía a ninguna empresa de
 * la base: la pantalla mostraba un emisor y el XML otro.
 */
export const RUC_EMISOR = '20601234567';

/** RUC válido (módulo 11) usado como adquirente en las notas de crédito. */
const RUC_CORPORACION = '20100070970';
const RS_CORPORACION = 'CORPORACIÓN TEXTIL DEL NORTE S.A.C.';

/** Comprobantes de ejemplo del periodo octubre 2026. */
export const COMPROBANTES_DEMO = [
  construir({
    tipo: '01', serie: 'F001', correlativo: 42, ruc: RUC_CORPORACION,
    razonSocial: RS_CORPORACION,
    fecha: '2026-10-16', base: 1000, estado: 'ACEPTADO', cdrCodigo: '0',
    items: [
      { codigo: 'SRV-001', descripcion: 'Servicio de confección de polos',
        unidad: 'NIU', cantidad: 100, valorUnitario: 10, afectacion: 'GRAVADA' },
    ],
  }),
  construir({
    // Una Boleta solo puede emitirse a una persona natural con DNI de 8
    // dígitos (Catálogo 06). Antes llevaba un RUC 10, que corresponde a una
    // Factura y SUNAT habría rechazado.
    tipo: '03', serie: 'B001', correlativo: 108, ruc: '45896325',
    razonSocial: 'JUAN CARLOS PEREZ GOMEZ',
    fecha: '2026-10-16', base: 150, estado: 'ACEPTADO', cdrCodigo: '0',
  }),
  construir({
    tipo: '01', serie: 'F001', correlativo: 43, ruc: '20481234566',
    razonSocial: 'SUPERMERCADOS PERUANOS S.A.C.',
    fecha: '2026-10-15', base: 2500, detraccionPct: 0.12,
    estado: 'ACEPTADO', cdrCodigo: '0',
    formaPago: 'Credito', numeroCuotas: 2,
  }),
  construir({
    tipo: '01', serie: 'F001', correlativo: 44, ruc: '20554433228',
    razonSocial: 'DISTRIBUIDORA CALLAO E.I.R.L.',
    fecha: '2026-10-15', base: 980, agenteRetencion: true,
    estado: 'OBSERVADO', cdrCodigo: '4272',
    formaPago: 'Credito', numeroCuotas: 3,
  }),
  construir({
    tipo: '03', serie: 'B001', correlativo: 109, ruc: '40551234',
    razonSocial: 'MARIA ELENA TORRES RIVAS',
    fecha: '2026-10-14', base: 320, estado: 'EN_COLA',
    tiempoDespachoMs: 1240,
  }),
  construir({
    tipo: '07', serie: 'FC01', correlativo: 7, ruc: RUC_CORPORACION,
    razonSocial: RS_CORPORACION,
    fecha: '2026-10-14', base: 200, estado: 'ACEPTADO', cdrCodigo: '0',
    documentoAfectado: 'F001-42',
    motivoNota: {
      codigo: '01',
      descripcion: 'Anulación de la operación',
    },
  }),
  construir({
    tipo: '08', serie: 'FD01', correlativo: 3, ruc: '20481234566',
    razonSocial: 'SUPERMERCADOS PERUANOS S.A.C.',
    fecha: '2026-10-13', base: 450, estado: 'ACEPTADO', cdrCodigo: '0',
    documentoAfectado: 'F001-43',
    motivoNota: {
      codigo: '02',
      descripcion: 'Aumento en el valor',
    },
  }),
  construir({
    tipo: '01', serie: 'F001', correlativo: 45, ruc: '20998877661',
    razonSocial: 'CONSTRUCTORA ANDINA DEL SUR S.A.C.',
    fecha: '2026-10-13', base: 1800, estado: 'RECHAZADO', cdrCodigo: '2017',
  }),
  construir({
    tipo: '03', serie: 'B001', correlativo: 110, ruc: '41778899',
    razonSocial: 'LUIS ALBERTO QUISPE MAMANI',
    fecha: '2026-10-12', base: 95, estado: 'RECHAZADO', cdrCodigo: '2335',
  }),
  construir({
    tipo: 'RA', serie: 'RA-20261016', correlativo: 1, ruc: RUC_EMISOR,
    razonSocial: 'Comunicación de baja F001-40',
    fecha: '2026-10-16', base: 0, estado: 'ACEPTADO', cdrCodigo: '0',
  }),
  construir({
    tipo: 'RC', serie: 'RC-20261016', correlativo: 1, ruc: RUC_EMISOR,
    razonSocial: 'Resumen diario de boletas',
    fecha: '2026-10-16', base: 0, estado: 'ACEPTADO', cdrCodigo: '0',
  }),
];

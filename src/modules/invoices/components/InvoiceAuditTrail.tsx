import { lecturaRechazo, lecturaIncertidumbre } from '../lib/invoiceResultPresentation';
/**
 * Bitácora de auditoría del comprobante (M1).
 *
 * QUÉ MOSTRABA ANTES Y POR QUÉ ESTABA MAL
 *
 * Pintaba cinco etapas del pipeline ("Ingesta Outbox", "Generación XML",
 * "Validación XSD", "Firma", "Envío SOAP") con tiempos de 180 ms, 360 ms,
 * 540 ms… y un "OK" verde en cada una. Nada de eso se medía: el tiempo se
 * calculaba como `180 * númeroDeEtapa` y el "OK" salía de mirar el estado final
 * del comprobante. En una pantalla de AUDITORÍA eso es lo peor que se puede
 * hacer: un jurado o el docente lo lee como evidencia de que el sistema midió
 * cada paso, y no midió ninguno.
 *
 * QUÉ MUESTRA AHORA
 *
 * Los datos que el backend sí guarda del comprobante: su estado real, el código
 * y la descripción del CDR, el hash del XML y la fecha de emisión. Si un dato no
 * existe, se dice que no está en lugar de rellenarlo con una cifra inventada.
 */
import { Badge, PageText } from '@/components/ui';
import type { ComprobanteDemo } from '../data/invoiceDemoTypes';
import {
  LECTURA_ERROR_RED as LECTURA_ERROR_RED_COMPARTIDA,
  esErrorDeRed,
} from '../lib/invoiceRedError';

interface InvoiceAuditTrailProps {
  comprobante: ComprobanteDemo;
  digest?: string | null;
  historial?: readonly { id: string; fecha: string; mensaje: string | null }[];
  errorHistorial?: boolean;
}

/** Estados que el sistema reconoce, con su lectura en lenguaje claro. */
const LECTURA_DEL_ESTADO: Record<string, string> = {
  EN_COLA: 'Está en la cola de envío. SUNAT todavía no ha respondido.',
  ACEPTADO: 'SUNAT aceptó el comprobante y devolvió su CDR.',
  OBSERVADO: 'SUNAT aceptó el comprobante pero anotó observaciones.',
  /**
   * Fallo de transmisión. Vive en `lib/invoiceRedError` junto al criterio, para
   * que la bitácora y el modal no puedan discrepar sobre el mismo comprobante.
   */
  SIN_CONFIRMAR: LECTURA_ERROR_RED_COMPARTIDA,
  RECHAZADO: 'SUNAT rechazó el comprobante. No tiene validez fiscal.',
};

/** Bitácora con los datos reales del comprobante. */
export const InvoiceAuditTrail = ({ comprobante, digest, historial, errorHistorial }: InvoiceAuditTrailProps) => {
  const rechazo = (comprobante.estado === 'RECHAZADO' || ['PREPARACION_LOCAL', 'RA_REVERSAL_PENDING', 'RA_REVERSAL_DONE'].includes(comprobante.resultadoPresentacion?.origen ?? '')) ? lecturaRechazo(comprobante.resultadoPresentacion) : null;
  const aceptado =
    comprobante.estado === 'ACEPTADO' || comprobante.estado === 'OBSERVADO';
  // Desde que ERROR_RED llega como SIN_CONFIRMAR, el estado se basta a sí
  // mismo. `esErrorDeRed` se conserva como respaldo para filas antiguas que
  // todavía traigan el estado colapsado desde el backend.
  const falloDeRed = !['PREPARACION_LOCAL', 'RA_REVERSAL_PENDING', 'RA_REVERSAL_DONE'].includes(comprobante.resultadoPresentacion?.origen ?? '') && (
    comprobante.resultadoPresentacion?.origen === 'TRANSPORTE_INCIERTO' || comprobante.estado === 'SIN_CONFIRMAR' || esErrorDeRed(comprobante));

  const filas: { etiqueta: string; valor: string }[] = [
    {
      etiqueta: 'Estado del comprobante',
      /*
       * El valor registrado por el sistema. En un fallo de envío es ERROR_RED,
       * el estado real del BACKEND, y no la etiqueta de pantalla: este campo
       * dice literalmente "lo que registró el sistema".
       */
      valor:
        (comprobante.estado === 'SIN_CONFIRMAR' || comprobante.resultadoPresentacion?.origen?.startsWith('RA_REVERSAL'))
          ? (comprobante.estadoBackend ?? 'ERROR_RED')
          : (comprobante.estado ?? 'No informado'),
    },
    {
      etiqueta: 'Lectura',
      // `LECTURA_DEL_ESTADO` ya incluye SIN_CONFIRMAR, así que una sola
      // consulta cubre los cinco estados.
      valor:
        (falloDeRed ? lecturaIncertidumbre(comprobante.resultadoPresentacion) : rechazo?.lectura) ?? LECTURA_DEL_ESTADO[comprobante.estado ?? ''] ??
        'Estado no reconocido por la interfaz.',
    },
    {
      etiqueta: 'Código CDR',
      valor: ['VALIDACION_LOCAL', 'PREPARACION_LOCAL', 'RA_REVERSAL_PENDING', 'RA_REVERSAL_DONE'].includes(comprobante.resultadoPresentacion?.origen ?? '') ? rechazo!.sinCdr : comprobante.cdrCodigo?.trim()
        ? comprobante.cdrCodigo
        : rechazo ? rechazo.sinCdr : falloDeRed
          // Sin CDR no se afirma que el comprobante nunca llegó a SUNAT.
          ? 'Sin CDR concluyente: recepción sin confirmar'
          : 'Sin código: SUNAT todavía no respondió',
    },
    {
      etiqueta: 'Descripción del CDR',
      valor: (falloDeRed ? lecturaIncertidumbre(comprobante.resultadoPresentacion) : rechazo?.motivo) ?? (comprobante.cdrDescripcion?.trim()
        ? comprobante.cdrDescripcion
        : 'No hay descripción registrada'),
    },
    {
      etiqueta: 'Hash del XML (digest)',
      valor: digest === undefined ? 'Consultando XML…' : digest?.trim() || 'No disponible en el XML firmado',
    },
  ];

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <PageText variant="label">Bitácora de Auditoría</PageText>
      <PageText variant="caption" className="text-muted-foreground">
        Datos registrados por el sistema para este comprobante.
      </PageText>

      {filas.map((fila) => (
        <div
          key={fila.etiqueta}
          className="flex items-start justify-between gap-3 border-t pt-1.5"
        >
          <PageText variant="caption" className="shrink-0">
            {fila.etiqueta}
          </PageText>
          <PageText
            variant="caption"
            className="break-all text-right font-medium"
          >
            {fila.valor}
          </PageText>
        </div>
      ))}

      <div className="space-y-1 border-t pt-2">
        <PageText variant="label">Historial de auditoría</PageText>
        {errorHistorial ? <PageText variant="caption">No se pudo cargar el historial.</PageText>
          : historial === undefined ? <PageText variant="caption">Cargando historial…</PageText>
          : historial.length === 0 ? <PageText variant="caption">No hay eventos de auditoría registrados.</PageText>
          : historial.map((evento) => <div key={evento.id}>
              <PageText variant="caption">{evento.fecha || 'Fecha no disponible'} · {evento.mensaje || 'Sin mensaje registrado'}</PageText>
            </div>)}
      </div>

      {/*
        Cierre de la Bitácora.

        Con un fallo de red NO hay "resultado ante SUNAT": no lo hubo. Se dice
        "SIN CONFIRMAR" y no "RECHAZADO", que es lo que decía antes y convertía
        un fallo de transmisión en un veredicto del fisco. Es el rótulo más
        visible de la ficha, así que es el que más pesa si miente.
      */}
      <div className="flex items-center justify-between border-t pt-1.5">
        <PageText variant="caption">
          {falloDeRed ? 'Resultado de la transmisión' : 'Resultado ante SUNAT'}
        </PageText>
        <Badge
          variant={aceptado ? 'secondary' : comprobante.estado === 'RECHAZADO' ? 'destructive' : 'outline'}
          className="text-[10px]"
        >
          {falloDeRed
            ? 'SIN CONFIRMAR'
            : aceptado
              ? 'ACEPTADO'
              : (comprobante.estado ?? 'PENDIENTE')}
        </Badge>
      </div>
    </div>
  );
};

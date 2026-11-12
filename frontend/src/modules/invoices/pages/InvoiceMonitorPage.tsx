import { InvoiceWriteButton } from '../components/InvoiceWriteButton';
import { InvoiceAggregateMonitor } from '../components/InvoiceAggregateMonitor';
/**
 * Monitor Outbox y Auditoría CDR — TA-28 / TA-29 / TA-69.
 *
 * POR QUÉ EXISTE ESTE COMPONENTE
 *
 * El apartado del menú mostraba la misma grilla de comprobantes que "Facturas y
 * Boletas". Pero el monitor no es un listado fiscal: es el estado de la COLA de
 * envío —qué está esperando, qué falló, qué agotó los reintentos— más la salud
 * del sistema (certificado y cola de muertos).
 *
 * QUÉ CONSUME
 *
 *  - `GET /invoices/alertas` (TA-69): certificado X.509 y conteo de la DLQ.
 *  - `GET /invoices?estado=...` filtrado por los estados que se están moviendo.
 *  - `POST /invoices/:id/retry-cdr`: reintento manual de un comprobante trabado.
 *
 * POR QUÉ SE PIDE EL LISTADO POR ESTADO Y NO TODOS
 *
 * El monitor mira el PRESENTE: lo que está en cola, lo que falló por red y lo
 * que todavía no se envió. Traer todo el histórico lo convertiría en una copia
 * de la bandeja.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Page,
  PageGrid,
  PageHeader,
  PageText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { RefreshCw, RotateCw } from 'lucide-react';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { invoicesApi } from '../services/invoicesApi';
import type { Invoice } from '../types/invoice.types';
import type { AlertasOperativas } from '../lib/invoiceAlertas';

/** Estados que el monitor vigila: todo lo que todavía no terminó. */
const ESTADOS_EN_VUELO = ['EN_COLA', 'ENVIADO', 'PENDIENTE', 'ERROR_RED'];

/** El último resultado explícito de cola evita perpetuar una DLQ ya rescatada. */
export const estadoDeMonitor = (inv: Invoice): string => {
  if (inv.resultadoPresentacion?.origen === 'BRIDGE_PENDING') return 'PUENTE_PENDIENTE';
  if (inv.resultadoPresentacion?.origen === 'TRANSPORTE_INCIERTO') return 'INCERTIDUMBRE_TRANSPORTE';
  if (inv.resultadoPresentacion?.origen === 'PREPARACION_LOCAL') return 'PREPARACION_LOCAL';
  const evento = [...(inv.historial ?? [])].reverse().find((e) => /\b(EN_DLQ|ENCOLADO|YA_EN_COLA)\b/.test(e.mensaje ?? ''));
  return evento?.mensaje?.includes('EN_DLQ') ? 'DLQ' : inv.estadoBackend ?? inv.cdrStatus;
};

export const contieneDlq = (inv: Invoice): boolean => (inv.historial ?? []).some(e => /\bEN_DLQ\b/.test(e.mensaje ?? ''));

/** Etiqueta y gravedad visual de cada alerta. */
const VARIANTE_POR_GRAVEDAD = {
  OK: 'outline',
  AVISO: 'secondary',
  CRITICO: 'destructive',
  SIN_DATOS: 'outline',
} as const;

export default function InvoiceMonitorPage() {
  const [alertas, setAlertas] = useState<AlertasOperativas | null>(null);
  const [enVuelo, setEnVuelo] = useState<readonly Invoice[]>([]);
  const [avisoPuente, setAvisoPuente] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const visibles = enVuelo.filter((inv) => filtroEstado === 'TODOS' || (filtroEstado === 'DLQ' ? contieneDlq(inv) : filtroEstado === 'INCERTIDUMBRE_TRANSPORTE' ? ['ERROR_RED', 'INCERTIDUMBRE_TRANSPORTE'].includes(estadoDeMonitor(inv)) : estadoDeMonitor(inv) === filtroEstado));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState<string | null>(null);
  // Independiente de la carga: actualizar la lista no borra el resultado.
  const [avisoReintento, setAvisoReintento] = useState<{
    encolado: boolean;
    mensaje: string;
  } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      // Las alertas y la cola se piden en paralelo: la primera abre pg-boss y
      // no debe retrasar el listado.
      const [a, paginas] = await Promise.all([
        invoicesApi.getAlertas(),
        Promise.all(
          [...ESTADOS_EN_VUELO, 'PUENTE_PENDIENTE'].map((estado) =>
            (async () => {
              const filtros = estado === 'PUENTE_PENDIENTE' ? { puente_pendiente: 'true', page_size: 100 } : { estado, page_size: 100 };
              const primera = await invoicesApi.getInvoices(1, filtros);
              const restantes = await Promise.all(Array.from({ length: Math.max(0, primera.totalPages - 1) }, (_, i) => invoicesApi.getInvoices(i + 2, filtros)));
              return { ...primera, data: [...primera.data, ...restantes.flatMap((p) => p.data)] };
            })(),
          ),
        ),
      ]);

      setAlertas(a);

      // Un comprobante puede aparecer en dos consultas si cambió de estado
      // entre una y otra: se deduplica por id.
      const vistos = new Map<string, Invoice>();
      for (const pagina of paginas) {
        for (const inv of pagina?.data ?? []) vistos.set(inv.id, inv);
      }
      const detalles = await Promise.all([...vistos.values()].map(async (inv) => {
        try { return { ...inv, ...await invoicesApi.getInvoiceById(inv.id) }; }
        catch { return inv; }
      }));
      setEnVuelo(detalles);
    } catch (e: unknown) {
      setError(
        extractApiErrorMessage(e, 'No se pudo leer el estado de la cola.'),
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // La carga se difiere a un microtask: cargar hace setState en su primera
    // línea (el indicador de carga) y llamarla directamente en el cuerpo del
    // efecto dispara la regla react-hooks/set-state-in-effect.
    let vivo = true;
    void Promise.resolve().then(() => {
      if (vivo) void cargar();
    });
    return () => {
      vivo = false;
    };
  }, [cargar]);

  const reprocesar = async (id: string) => {
    setReintentando(id); setAvisoPuente(null);
    try { const r = await invoicesApi.reprocesarPuente(id); setAvisoPuente(r.completo ? 'Puente completado.' : `Puente pendiente: ${r.errores.join(' ')}`); await cargar(); }
    catch (e) { setAvisoPuente(extractApiErrorMessage(e, 'No se pudo reprocesar el puente.')); }
    finally { setReintentando(null); }
  };

  const reintentar = async (id: string) => {
    setReintentando(id);
    setAvisoReintento(null);
    try {
      const resultado = await invoicesApi.retryCdr(id);
      setAvisoReintento({ encolado: resultado.encolado, mensaje: resultado.mensaje });
      await cargar();
    } catch (e: unknown) {
      setAvisoReintento({
        encolado: false,
        mensaje: extractApiErrorMessage(e, 'No se pudo reintentar el envío.'),
      });
    } finally {
      setReintentando(null);
    }
  };

  return (
    <Page>
      {avisoPuente && <p role="status">{avisoPuente}</p>}
      <InvoiceAggregateMonitor />
      <PageHeader
        title="Monitor Outbox y Auditoría CDR"
        description="Cola de envío, reintentos y salud del certificado de firma"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => void cargar()}
          disabled={cargando}
        >
          <RefreshCw aria-hidden="true" />
          {cargando ? 'Consultando…' : 'Actualizar'}
        </Button>
      </PageHeader>

      {avisoReintento && (
        <Alert variant={avisoReintento.encolado ? 'success' : 'destructive'}>
          <AlertTitle>
            {avisoReintento.encolado ? 'Comprobante reencolado' : 'Comprobante no reencolado'}
          </AlertTitle>
          <AlertDescription>{avisoReintento.mensaje}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo consultar la cola</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {alertas ? (<>
      {/*
        TA-69: las dos alertas que no se ven en ninguna cifra de la bandeja.
        El certificado que vence detiene la emisión (error 4000) y un comprobante
        en la DLQ no lo reintenta nadie.
      */}
      <PageGrid columns={2}>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Certificado digital</CardTitle>
            <Badge
              variant={
                VARIANTE_POR_GRAVEDAD[
                  alertas?.certificado.gravedad ?? 'SIN_DATOS'
                ]
              }
            >
              {alertas?.certificado.gravedad ?? 'SIN_DATOS'}
            </Badge>
          </CardHeader>
          <CardContent>
            <PageText className="text-xl font-semibold">
              {alertas?.certificado.diasRestantes ?? '—'} días
            </PageText>
            <PageText variant="caption">
              {alertas?.certificado.mensaje ??
                'Consultando el certificado digital…'}
            </PageText>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Cola de muertos (DLQ)</CardTitle>
            <Badge
              variant={
                VARIANTE_POR_GRAVEDAD[alertas?.dlq.gravedad ?? 'SIN_DATOS']
              }
            >
              {alertas?.dlq.gravedad ?? 'SIN_DATOS'}
            </Badge>
          </CardHeader>
          <CardContent>
            <PageText className="text-xl font-semibold">
              {alertas?.dlq.pendientes ?? 0}
            </PageText>
            <PageText variant="caption">
              {alertas?.dlq.mensaje ??
                'Consultando comprobantes que agotaron los reintentos…'}
            </PageText>
          </CardContent>
        </Card>
      </PageGrid>

      </>) : !error ? <div role="status">Cargando estado del monitor…</div> : null}

      {alertas && <Card flush>
        <CardHeader>
          <CardTitle className="text-base">
            Comprobantes en vuelo ({visibles.length})
          </CardTitle>
        </CardHeader>
        <label className="m-4 block text-sm">
          Estado de los comprobantes en vuelo
          <select aria-label="Filtrar estado del monitor" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="ml-2 rounded border bg-background p-2">
            <option value="TODOS">Todos los estados</option>
            {[...ESTADOS_EN_VUELO.filter(e => e !== 'ERROR_RED'), 'DLQ', 'INCERTIDUMBRE_TRANSPORTE', 'PREPARACION_LOCAL', 'PUENTE_PENDIENTE'].map((estado) => <option key={estado} value={estado}>{['ERROR_RED', 'INCERTIDUMBRE_TRANSPORTE'].includes(estado) ? 'Incertidumbre de transporte' : estado === 'PREPARACION_LOCAL' ? 'Bloqueado en preparación local' : estado === 'PUENTE_PENDIENTE' ? 'Puente pendiente' : estado}</option>)}
          </select>
        </label>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comprobante</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead align="center">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  {cargando
                    ? 'Consultando la cola de envío…'
                    : filtroEstado !== 'TODOS' ? 'No hay comprobantes con ese estado.' : 'No hay comprobantes esperando en la cola. Todo lo emitido ya tiene respuesta de SUNAT.'}
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.numero}</TableCell>
                  <TableCell>
                    <PageText variant="label">
                      {inv.clienteRazonSocial}
                    </PageText>
                    <PageText variant="caption">
                      RUC: {inv.clienteRuc}
                    </PageText>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        (estadoDeMonitor(inv) === 'ERROR_RED' || estadoDeMonitor(inv) === 'DLQ')
                          ? 'destructive'
                          : 'outline'
                      }
                    >
                      {['ERROR_RED', 'INCERTIDUMBRE_TRANSPORTE'].includes(estadoDeMonitor(inv)) ? 'Incertidumbre de transporte' : estadoDeMonitor(inv) === 'PREPARACION_LOCAL' ? 'Bloqueado en preparación local' : estadoDeMonitor(inv) === 'PUENTE_PENDIENTE' ? `${inv.estadoBackend} con puente pendiente` : estadoDeMonitor(inv)}
                    </Badge>
                  </TableCell>
                  <TableCell align="center">
                    {/* El servidor concilia antes de autorizar cualquier reenvío. */}
                    {estadoDeMonitor(inv) === 'PUENTE_PENDIENTE' && <InvoiceWriteButton disabled={reintentando === inv.id} onClick={() => void reprocesar(inv.id)}>Reprocesar puente</InvoiceWriteButton>}
                    {['TRANSPORTE_INCIERTO', 'PREPARACION_LOCAL', 'BRIDGE_PENDING'].includes(inv.resultadoPresentacion?.origen ?? '') && <p className="text-xs text-muted-foreground">{inv.resultadoPresentacion?.motivo}</p>}
                    {['ERROR_RED', 'DLQ', 'INCERTIDUMBRE_TRANSPORTE', 'PREPARACION_LOCAL'].includes(estadoDeMonitor(inv)) && !['ACEPTADO', 'OBSERVADO', 'ANULADO'].includes(inv.estadoBackend ?? '') && (
                      <InvoiceWriteButton
                        variant="outline"
                        size="sm"
                        disabled={reintentando === inv.id}
                        onClick={() => void reintentar(inv.id)}
                      >
                        <RotateCw aria-hidden="true" className="mr-1 h-3 w-3" />
                        {reintentando === inv.id ? '…' : 'Reintentar'}
                      </InvoiceWriteButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>}
    </Page>
  );
}

import { EnviarBajaPanel } from '../components/EnviarBajaPanel';
/**
 * Bajas y Resúmenes Diarios (RA / RC) — TA-67.
 *
 * POR QUÉ EXISTE ESTE COMPONENTE
 *
 * El apartado del menú mostraba la misma grilla de comprobantes que "Facturas y
 * Boletas": solo cambiaba el título. Pero un resumen diario y una comunicación
 * de baja no son comprobantes sueltos:
 *
 *  - **RC (resumen diario):** las boletas del día viajan AGRUPADAS en un solo
 *    XML con identificador `RC-AAAAMMDD-NNN` y devuelven un TICKET, no un CDR.
 *  - **RA (comunicación de baja):** la ANULACIÓN de facturas ya aceptadas.
 *
 * El docente preguntó en la revisión: "No sé a qué se refiere con el caso de las
 * bajas. ¿Se refieren a que ha sido anulado el comprobante de pago?". Sí, y por
 * eso esta pantalla separa las dos cosas en pestañas con su propio contenido.
 *
 * LA LISTA MUESTRA TAMBIÉN LO QUE NO ENTRA
 *
 * Un resumen que dice "7 líneas" cuando se emitieron 10 hace pensar que el
 * sistema perdió 3. Cada comprobante excluido se pinta con su motivo: fuera del
 * plazo de 7 días (regla 2957), rechazado por SUNAT o ya anulado.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Page,
  PageHeader,
  PageText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { RefreshCw } from 'lucide-react';
import { invoicesApi } from '../services/invoicesApi';
import { hoyEnLima } from '../lib/invoiceFecha';
import { EnviarResumenDiarioBoton } from '../components/EnviarResumenDiarioBoton';
import {
  esLineaReenviable,
  ETIQUETA_ESTADO_SUNAT,
  ETIQUETA_TIPO,
  resumirVista,
  type LineaResumen,
  type VistaPreviaResumen,
} from '../lib/invoiceResumenes';

/*
 * Aquí vivía `hoyLima()`, una copia local del cálculo de «hoy en Lima» con el
 * desfase escrito a mano. Se retiró: la fuente única es `hoyEnLima()` en
 * `../lib/invoiceFecha`, para que las pantallas del módulo no puedan
 * desincronizarse entre sí.
 */

type Pestana = 'resumen' | 'baja';

export default function InvoiceBajasPage() {
  const solicitud = useRef(0);
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [fecha, setFecha] = useState(hoyEnLima());
  const [vista, setVista] = useState<VistaPreviaResumen | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reenviandoClave, setReenviandoClave] = useState<string | null>(null);
  const [mensajeReenvio, setMensajeReenvio] = useState<string | null>(null);

  const cargar = useCallback(async (tipo: Pestana, dia: string) => {
    const actual = ++solicitud.current;
    setCargando(true);
    setError(null);
    try {
      const datos =
        tipo === 'resumen'
          ? await invoicesApi.getVistaResumen(dia)
          : await invoicesApi.getVistaBaja(dia);
      if (actual === solicitud.current) setVista(datos);
    } catch (e: unknown) {
      if (actual !== solicitud.current) return;
      setVista(null);
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo cargar la vista previa del envío.',
      );
    } finally {
      if (actual === solicitud.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    // Diferido a un microtask por la misma razón que en el monitor: cargar
    // hace setState de inmediato.
    let vivo = true;
    void Promise.resolve().then(() => {
      if (vivo) void cargar(pestana, fecha);
    });
    return () => {
      vivo = false;
    };
  }, [pestana, fecha, cargar]);

  const conteo = resumirVista(vista);

  const reenviarFila = async (linea: LineaResumen) => {
    const clave = linea.id ?? `${linea.serie}-${linea.correlativo}`;
    setReenviandoClave(clave);
    setMensajeReenvio(null);
    setError(null);
    try {
      if (pestana === 'resumen' && (linea.tipoComprobante === '03' || linea.serie.startsWith('B'))) {
        if (linea.id) {
          const r = await invoicesApi.retryCdr(linea.id);
          setMensajeReenvio(r.mensaje);
        } else {
          const r = await invoicesApi.enviarResumenDiario(fecha);
          setMensajeReenvio(r.motivo ?? `Resumen ${r.identificador} encolado para envío a SUNAT.`);
        }
      } else if (linea.id) {
        const r = await invoicesApi.retryCdr(linea.id);
        setMensajeReenvio(r.mensaje);
      }
      await cargar(pestana, fecha);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo reenviar el comprobante a SUNAT.');
    } finally {
      setReenviandoClave(null);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Anulación de comprobantes y Resúmenes Diarios"
        description="Baja (RA) = anula una factura ya aceptada. Resumen diario (RC) = agrupa las boletas del día. No es baja de mercadería ni de inventario."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => void cargar(pestana, fecha)}
          disabled={cargando}
        >
          <RefreshCw aria-hidden="true" />
          {cargando ? 'Cargando…' : 'Actualizar'}
        </Button>
      </PageHeader>

      {/* Dos envíos distintos, no dos vistas del mismo listado. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-lg border p-1" role="tablist">
          <Button
            type="button"
            size="sm"
            variant={pestana === 'resumen' ? 'default' : 'ghost'}
            role="tab"
            aria-selected={pestana === 'resumen'}
            onClick={() => { if (pestana !== 'resumen') { solicitud.current++; setVista(null); setPestana('resumen'); } }}
          >
            Resumen diario (RC)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={pestana === 'baja' ? 'default' : 'ghost'}
            role="tab"
            aria-selected={pestana === 'baja'}
            onClick={() => { if (pestana !== 'baja') { solicitud.current++; setVista(null); setPestana('baja'); } }}
          >
            Anulación de comprobante (RA)
          </Button>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="fecha-envio"
            className="text-xs font-medium text-foreground"
          >
            Fecha de referencia
          </label>
          <input
            id="fecha-envio"
            type="date"
            value={fecha}
            onChange={(e) => { solicitud.current++; setVista(null); setFecha(e.target.value); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </div>

      <PageText variant="caption">
        {pestana === 'resumen'
          ? 'El resumen diario agrupa las boletas (03) y sus notas del día. SUNAT devuelve un TICKET y el CDR se consulta después.'
          : 'Aquí se ANULA un comprobante ante SUNAT: la factura (01) ya aceptada deja de tener efecto. No es una baja de mercadería ni un ajuste de inventario — para eso se usa el Kardex del módulo de inventario. Una BOLETA tampoco se anula aquí: se resta en un resumen posterior (regla 2308).'}
      </PageText>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3">
            <PageText variant="error">{error}</PageText>
          </CardContent>
        </Card>
      )}

      {vista && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {vista.envio.identificador}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {conteo.incluidos} incluido(s)
              </Badge>
              {conteo.excluidos > 0 && (
                <Badge variant="destructive">
                  {conteo.excluidos} excluido(s)
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {vista.errores.length > 0 && (
              <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-2">
                {vista.errores.map((e) => (
                  <PageText variant="error" key={e}>
                    {e}
                  </PageText>
                ))}
              </div>
            )}

            {mensajeReenvio && (
                <div className="mb-3 rounded-md border bg-muted/40 p-2 text-xs" role="status">
                  {mensajeReenvio}
                </div>
              )}
              {pestana === 'baja' ? <EnviarBajaPanel key={fecha} fecha={fecha} vista={vista} onEnviado={() => void cargar(pestana, fecha)} /> : <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado SUNAT</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead align="right">Total</TableHead>
                  <TableHead>¿Entra?</TableHead>
                  <TableHead align="right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vista.lineas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      {pestana === 'resumen'
                        ? 'No se emitieron boletas en esta fecha.'
                        : 'No hay facturas ni notas emitidas en esta fecha.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  vista.lineas.map((l) => {
                    const clave = l.id ?? `${l.serie}-${l.correlativo}`;
                    const numeroFmt = `${l.serie}-${String(l.correlativo).padStart(8, '0')}`;
                    const puedeReenviar = esLineaReenviable(l);
                    return (
                      <TableRow key={clave}>
                        <TableCell>{numeroFmt}</TableCell>
                        <TableCell>
                          {ETIQUETA_TIPO[l.tipoComprobante] ?? l.tipoComprobante}
                        </TableCell>
                        <TableCell>
                          <Badge variant={l.estado === 'ACEPTADO' || l.estado === 'OBSERVADO' ? 'secondary' : 'outline'}>
                            {ETIQUETA_ESTADO_SUNAT[l.estado] ?? l.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>{l.fechaEmision}</TableCell>
                        <TableCell align="right">
                          S/ {l.total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {l.incluido ? (
                            <Badge variant="outline">Sí</Badge>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant="destructive">No</Badge>
                              <PageText variant="caption">
                                {l.motivoExclusion}
                              </PageText>
                            </div>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {puedeReenviar ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={reenviandoClave === clave}
                              aria-label={`Reenviar ${numeroFmt} a SUNAT`}
                              onClick={() => void reenviarFila(l)}
                            >
                              <RefreshCw aria-hidden="true" />
                              {reenviandoClave === clave ? 'Reenviando…' : 'Reenviar a SUNAT'}
                            </Button>
                          ) : (
                            <PageText variant="caption">—</PageText>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>}

            {/* RC conserva confirmación y respuesta literal; el Monitor sigue el ticket. */}
            {pestana === 'resumen' && (
              <div className="mt-3">
                <EnviarResumenDiarioBoton
                  fecha={fecha}
                  identificador={vista.envio.identificador}
                  incluidos={conteo.incluidos}
                  puedeEnviar={
                    conteo.incluidos > 0 && vista.errores.length === 0
                  }
                  onEnviado={() => void cargar(pestana, fecha)}
                />
              </div>
            )}

            {pestana === 'resumen' && vista.xml && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Ver el XML que se enviaría
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-md border bg-muted/40 p-2 text-[10px] leading-tight">
                  {vista.xml}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

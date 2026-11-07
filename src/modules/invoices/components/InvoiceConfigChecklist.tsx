/**
 * Checklist de configuración del emisor electrónico (D1).
 *
 * POR QUÉ ESTA PIEZA NO EXISTÍA
 *
 * El backend devuelve desde TA-60 un `checklist` con el estado del entorno, del
 * usuario SOL, del certificado digital y de las series, más un
 * `listo_para_emitir` que dice si con eso se puede facturar de verdad. El hook
 * `useInvoiceConfig` ya lo traía normalizado.
 *
 * La pantalla, en cambio, solo pintaba el RUC y las series. Los cuatro puntos
 * viajaban de la API al navegador en cada carga y se descartaban al llegar: el
 * usuario veía un formulario con los datos del emisor y no tenía forma de saber
 * si SUNAT aceptaría sus comprobantes.
 *
 * Aquí se muestra tal cual lo informa el servidor. NO se reimplementa el
 * criterio: este componente no decide qué está configurado, solo lo presenta.
 */
import { Badge, Card, PageText, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import type { ConfiguracionFeVista } from '../hooks/useInvoiceConfig';

/** Un punto del checklist, con su estado en palabras. */
const EstadoPunto = ({ configurado, obligatorio }: {
  configurado: boolean;
  obligatorio: boolean;
}) => {
  if (configurado) return <Badge variant="outline">Configurado</Badge>;
  return (
    <Badge variant={obligatorio ? 'destructive' : 'secondary'}>
      {obligatorio ? 'Falta' : 'Sin configurar'}
    </Badge>
  );
};

interface Props {
  config: ConfiguracionFeVista;
}

/** Resumen de si el emisor puede facturar, con el detalle de cada requisito. */
export const InvoiceConfigChecklist = ({ config }: Props) => (
  <Card flush>
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <PageText variant="label">Estado para emitir</PageText>
      <Badge variant={config.listo_para_emitir ? 'outline' : 'destructive'}>
        {config.listo_para_emitir
          ? 'Listo para emitir'
          : 'Hay requisitos sin cubrir'}
      </Badge>
    </div>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Requisito</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Detalle</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {config.checklist.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} align="center">
              El servidor no informó el checklist de configuración.
            </TableCell>
          </TableRow>
        ) : (
          config.checklist.map((punto) => (
            <TableRow key={punto.clave}>
              <TableCell>
                {punto.descripcion}
                {/* `obligatorio` decide si su ausencia IMPIDE emitir o solo
                    degrada. Se dice, porque no es lo mismo un certificado
                    ausente que un correo de copia sin configurar. */}
                {!punto.obligatorio && (
                  <PageText variant="caption">Opcional</PageText>
                )}
              </TableCell>
              <TableCell>
                <EstadoPunto
                  configurado={punto.configurado}
                  obligatorio={punto.obligatorio}
                />
              </TableCell>
              <TableCell>{punto.detalle ?? '—'}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>

    <div className="space-y-1 px-3 py-2">
      <PageText variant="caption">
        Servicio de facturación: {config.endpoint_bill_service || 'sin definir'}
      </PageText>
      <PageText variant="caption">
        Servicio de consulta: {config.endpoint_consult_service || 'sin definir'}
      </PageText>
    </div>
  </Card>
);

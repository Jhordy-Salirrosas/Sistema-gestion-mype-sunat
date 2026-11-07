import { Badge, Card, Page, PageText, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { InvoiceIssuerConfigForm } from './InvoiceIssuerConfigForm';
import { nombreTipo, type SerieFe } from '../lib/invoiceSettings';
import type { ConfiguracionBackend, ConfiguracionInput } from '../hooks/useInvoiceConfig';

export const InvoiceSettingsTab = ({ ruc, configuracion, series = [], onGuardar }: {
  ruc: string; configuracion?: Omit<ConfiguracionBackend, 'series'>; series?: readonly SerieFe[];
  onGuardar: (input: ConfiguracionInput) => Promise<void>;
}) => <Page>
  {configuracion && <InvoiceIssuerConfigForm key={ruc} ruc={ruc} config={configuracion} guardar={onGuardar} />}
      <Card flush>
        <PageText variant="label">Series disponibles</PageText>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serie</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead align="right">Siguiente</TableHead>
              <TableHead align="center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  La empresa todavía no tiene series registradas.
                </TableCell>
              </TableRow>
            ) : (
              series.map((s) => (
                <TableRow key={s.serie}>
                  <TableCell>{s.serie}</TableCell>
                  <TableCell>{nombreTipo(s.tipoComprobante)}</TableCell>
                  <TableCell align="right">
                    {s.siguienteCorrelativo !== undefined
                      ? `${s.serie}-${String(s.siguienteCorrelativo).padStart(8, '0')}`
                      : '—'}
                  </TableCell>
                  <TableCell align="center">
                    <Badge variant="outline">
                      {s.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
</Page>;

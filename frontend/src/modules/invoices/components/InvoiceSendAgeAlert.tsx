import { Badge, Card, CardContent, CardHeader, CardTitle, PageText, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import type { AlertaAntiguedadEnvio } from '../lib/invoiceAlertas';

export function InvoiceSendAgeAlert({ alerta }: { alerta: AlertaAntiguedadEnvio }) {
  return <Card>
    <CardHeader><CardTitle>Plazo de envío</CardTitle><Badge variant={alerta.gravedad === 'CRITICO' ? 'destructive' : 'outline'}>{alerta.gravedad}</Badge></CardHeader>
    <CardContent>
      <PageText>{alerta.mensaje}</PageText>
      {alerta.documentos.length > 0 && <>
        <PageText variant="caption">Revise los documentos con plazo próximo o vencido. Mostrando {Math.min(10, alerta.documentos.length)} de {alerta.documentos.length}.</PageText>
        <Table><TableHeader><TableRow><TableHead>Comprobante</TableHead><TableHead>Estado</TableHead><TableHead>Emisión</TableHead><TableHead>Fecha límite</TableHead><TableHead>Plazo restante</TableHead></TableRow></TableHeader>
          <TableBody>{alerta.documentos.slice(0, 10).map(d => <TableRow key={d.id}><TableCell>{d.numero}</TableCell><TableCell>{d.estado}</TableCell><TableCell>{d.fechaEmision}</TableCell><TableCell>{d.fechaLimite}</TableCell><TableCell>{d.diasRestantes < 0 ? `Vencido hace ${-d.diasRestantes} día(s)` : `${d.diasRestantes} día(s)`}</TableCell></TableRow>)}</TableBody>
        </Table>
      </>}
    </CardContent>
  </Card>;
}

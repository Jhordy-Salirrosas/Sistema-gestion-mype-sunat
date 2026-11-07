import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Card, Input, Page, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { accountingApi } from '../services/accountingApi';

const periodoActual = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
};

const normalizarPeriodo = (value: string): string => {
  const match = /^(\d{4})-(\d{1,2})$/.exec(value);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}` : value;
};

const money = (value: number) => `S/ ${value.toFixed(2)}`;

export default function AccountingBalanceSheetPage() {
  const [period, setPeriod] = useState(periodoActual);
  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting-balance-sheet', period],
    queryFn: () => accountingApi.getBalanceSheet(period),
  });

  return (
    <Page>
      <PageHeader
        title="Balance General"
        description="Activo, pasivo y patrimonio al cierre del período"
      />

      <Card className="mb-4 p-4">
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 max-w-xs">
            <label className="text-xs font-medium">Período</label>
            <Input
              type="month"
              value={period}
              onChange={(event) => setPeriod(normalizarPeriodo(event.target.value))}
            />
          </div>
          <Badge variant={data?.cuadra ? 'outline' : 'destructive'}>
            {data ? (data.cuadra ? 'Cuadrado' : 'Descuadrado') : 'Sin datos'}
          </Badge>
        </div>
      </Card>

      {error ? (
        <Card className="p-4 mb-4 text-sm text-destructive">
          No se pudo cargar el balance general. Verifica el período.
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card flush>
          <div className="p-4 border-b flex justify-between">
            <h3 className="font-semibold">Activo</h3>
            <span className="font-semibold">{money(data?.totalActivo ?? 0)}</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Denominación</TableHead>
                <TableHead align="right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3}>Cargando…</TableCell></TableRow>
              ) : !data || data.activo.lines.length === 0 ? (
                <TableRow><TableCell colSpan={3}>Sin cuentas de activo.</TableCell></TableRow>
              ) : data.activo.lines.map((line) => (
                <TableRow key={line.accountCode}>
                  <TableCell className="font-mono">{line.accountCode}</TableCell>
                  <TableCell>{line.accountName}</TableCell>
                  <TableCell align="right">{money(line.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card flush>
          <div className="p-4 border-b flex justify-between">
            <h3 className="font-semibold">Pasivo y Patrimonio</h3>
            <span className="font-semibold">{money(data?.totalPasivoPatrimonio ?? 0)}</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Denominación</TableHead>
                <TableHead align="right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data ? (
                <TableRow><TableCell colSpan={3}>Sin datos.</TableCell></TableRow>
              ) : (
                <>
                  {[...data.pasivo.lines, ...data.patrimonio.lines].map((line) => (
                    <TableRow key={line.accountCode}>
                      <TableCell className="font-mono">{line.accountCode}</TableCell>
                      <TableCell>{line.accountName}</TableCell>
                      <TableCell align="right">{money(line.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-mono">—</TableCell>
                    <TableCell>Resultado del ejercicio</TableCell>
                    <TableCell align="right">{money(data.resultadoEjercicio)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {data ? (
        <div className="mt-4 flex justify-end gap-6 text-sm font-semibold">
          <span>Total activo: {money(data.totalActivo)}</span>
          <span>Total pasivo + patrimonio: {money(data.totalPasivoPatrimonio)}</span>
        </div>
      ) : null}
    </Page>
  );
}

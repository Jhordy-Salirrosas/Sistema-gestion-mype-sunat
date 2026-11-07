import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Input, Page, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
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

export default function AccountingIncomeStatementPage() {
  const [period, setPeriod] = useState(periodoActual);
  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting-income-statement', period],
    queryFn: () => accountingApi.getIncomeStatement(period),
  });

  return (
    <Page>
      <PageHeader
        title="Estado de Resultados"
        description="Ingresos, costo de ventas y gastos operativos del período"
      />

      <Card className="mb-4 p-4">
        <div className="space-y-1.5 max-w-xs">
          <label className="text-xs font-medium">Período</label>
          <Input
            type="month"
            value={period}
            onChange={(event) => setPeriod(normalizarPeriodo(event.target.value))}
          />
        </div>
      </Card>

      {error ? (
        <Card className="p-4 mb-4 text-sm text-destructive">
          No se pudo cargar el estado de resultados. Verifica el período.
        </Card>
      ) : null}

      <Card flush>
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
              <TableRow>
                <TableCell colSpan={3}>Cargando estado de resultados…</TableCell>
              </TableRow>
            ) : !data ? null : (
              <>
                {data.groups.map((group) => (
                  <>
                    <TableRow key={`h-${group.key}`}>
                      <TableCell colSpan={2} className="font-semibold">{group.label}</TableCell>
                      <TableCell align="right" className="font-semibold">{money(group.total)}</TableCell>
                    </TableRow>
                    {group.lines.map((line) => (
                      <TableRow key={line.accountCode}>
                        <TableCell className="font-mono">{line.accountCode}</TableCell>
                        <TableCell>{line.accountName}</TableCell>
                        <TableCell align="right">{money(line.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </>
                ))}
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Resultado bruto</TableCell>
                  <TableCell align="right" className="font-semibold">{money(data.resultadoBruto)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Resultado operativo</TableCell>
                  <TableCell align="right" className="font-semibold">{money(data.resultadoOperativo)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </Card>
    </Page>
  );
}

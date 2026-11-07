import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { formatCurrency } from '@/lib/formatters';
import type { ReconcileResult, ReconcileScenario } from '../types/sire.types';
import { scenarioPresentation } from '../lib/sireScenarios';
import { MatchStatusBadge } from './MatchStatusBadge';

interface Props {
  results: ReconcileResult[];
}

const money = (amount: number) => formatCurrency(amount, 'PEN');

export const SireVouchersTable = ({ results }: Props) => {
  const [scenario, setScenario] = useState<ReconcileScenario | 'TODOS'>('TODOS');
  const visibleResults = scenario === 'TODOS'
    ? results
    : results.filter((result) => result.escenario === scenario);

  return (
    <Card flush>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Resultados de conciliación</CardTitle>
        <label className="flex items-center gap-2 text-sm">
          Filtrar por escenario
          <select
            aria-label="Filtrar por escenario"
            className="h-8 rounded-lg border border-input bg-background px-2"
            value={scenario}
            onChange={(event) => setScenario(event.target.value as ReconcileScenario | 'TODOS')}
          >
            <option value="TODOS">Todos</option>
            {Object.entries(scenarioPresentation).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comprobante</TableHead>
              <TableHead align="right">Total local</TableHead>
              <TableHead align="right">Total SIRE</TableHead>
              <TableHead align="right">Diferencia total</TableHead>
              <TableHead align="right">Diferencia base</TableHead>
              <TableHead align="right">Diferencia IGV</TableHead>
              <TableHead>Escenario</TableHead>
              <TableHead>Origen duplicado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleResults.length ? visibleResults.map((result, index) => (
              <TableRow key={`${result.llave}-${index}`}>
                <TableCell>{result.tipoComprobante} · {result.serie}-{result.correlativo}</TableCell>
                <TableCell align="right">{result.totalLocal == null ? '—' : money(result.totalLocal)}</TableCell>
                <TableCell align="right">{result.totalSire == null ? '—' : money(result.totalSire)}</TableCell>
                <TableCell align="right">{money(result.diferenciaTotal)}</TableCell>
                <TableCell align="right">{money(result.diferenciaBase)}</TableCell>
                <TableCell align="right">{money(result.diferenciaIgv)}</TableCell>
                <TableCell><MatchStatusBadge status={result.escenario} /></TableCell>
                <TableCell>
                  {result.escenario === 'DUPLICADO_LLAVE'
                    ? result.duplicateSource ?? 'Origen no informado'
                    : '—'}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  {results.length ? 'No hay resultados para este filtro.' : 'Aún no hay resultados de conciliación.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateToPeru } from '@/lib/formatters';
import { type CustomsDeclarationSummary } from '../types/customs.types';
import { Eye, FileSpreadsheet, Loader2 } from 'lucide-react';

interface Props {
  declarations: CustomsDeclarationSummary[];
  isLoading: boolean;
  onSelectDeclaration: (id: string) => void;
  searchQuery: string;
}

export const DeclarationsTable = ({
  declarations,
  isLoading,
  onSelectDeclaration,
  searchQuery,
}: Props) => {
  const filtered = declarations.filter((d) => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    const duaNumber = String(d.dua_number || (d as any).duaNumber || '').toLowerCase();
    const agencyCode = String(d.customs_agency_code || (d as any).customsAgencyCode || '').toLowerCase();
    return duaNumber.includes(q) || agencyCode.includes(q);
  });

  if (isLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground border rounded-xl bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-xs">Cargando pólizas de importación...</span>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground border rounded-xl bg-card">
        <FileSpreadsheet className="h-8 w-8 text-muted-foreground/60" />
        <span className="text-sm font-medium">No se encontraron declaraciones aduaneras</span>
        <span className="text-xs text-muted-foreground/80">
          {searchQuery ? 'Prueba con otro término de búsqueda' : 'Registra tu primera DAM con el botón superior'}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="font-semibold text-xs">N° DAM / DUA</TableHead>
            <TableHead className="font-semibold text-xs">Aduana</TableHead>
            <TableHead className="font-semibold text-xs">Fecha Num.</TableHead>
            <TableHead className="font-semibold text-xs text-right">CIF Total ($)</TableHead>
            <TableHead className="font-semibold text-xs text-right">Tributos (S/)</TableHead>
            <TableHead className="font-semibold text-xs text-center">Series</TableHead>
            <TableHead className="font-semibold text-xs text-center">Estado</TableHead>
            <TableHead className="font-semibold text-xs text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item) => (
            <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-mono text-xs font-semibold text-primary">
                {item.dua_number}
              </TableCell>
              <TableCell className="text-xs">{item.customs_agency_code}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDateToPeru(item.numeration_date)}
              </TableCell>
              <TableCell className="text-xs text-right font-medium">
                {formatCurrency(item.cif_value_usd, 'USD')}
              </TableCell>
              <TableCell className="text-xs text-right font-medium text-amber-600 dark:text-amber-400">
                {formatCurrency(item.total_customs_taxes_pen, 'PEN')}
              </TableCell>
              <TableCell className="text-xs text-center">
                <span className="px-2 py-0.5 rounded-full bg-muted font-mono text-[11px]">
                  {item.items_count}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[10px] font-semibold"
                >
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-xs hover:text-primary hover:bg-primary/10"
                  onClick={() => onSelectDeclaration(item.id)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver Detalle
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

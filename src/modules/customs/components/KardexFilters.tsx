import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw } from 'lucide-react';
import { type KardexFilterParams } from '../types';

interface KardexFiltersProps {
  filters: KardexFilterParams;
  onChange: (filters: KardexFilterParams) => void;
  onReset: () => void;
}

export const KardexFilters: React.FC<KardexFiltersProps> = ({
  filters,
  onChange,
  onReset,
}) => {
  return (
    <Card className="border-border/60 shadow-xs bg-card">
      <CardContent className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <label className="font-semibold text-foreground block mb-1">Buscar Producto</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={filters.product_code || ''}
                onChange={(e) => onChange({ ...filters, product_code: e.target.value })}
                placeholder="Código o descripción..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Fecha Desde</label>
            <Input
              type="date"
              value={filters.start_date || ''}
              onChange={(e) => onChange({ ...filters, start_date: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Fecha Hasta</label>
            <Input
              type="date"
              value={filters.end_date || ''}
              onChange={(e) => onChange({ ...filters, end_date: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          <div className="flex items-end gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 flex-1"
              onClick={onReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

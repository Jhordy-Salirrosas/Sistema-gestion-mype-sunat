/**
 * Barra de control y acciones del módulo de Facturación (M1).
 *
 * Agrupa el buscador por RUC/DNI o serie-correlativo, el selector de estado
 * CDR, el rango de fechas, el menú de emisión y el botón de actualización.
 */
import {
  Button,
  FilterBar,
  FilterItem,
  FilterSearch,
  Input,
  PageField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { EstadoCdrDemo } from '../data/invoiceDemoSchema';
import { InvoiceEmitMenu, type TipoEmision } from './InvoiceEmitMenu';

export type { TipoEmision };

/** Valores disponibles del filtro por estado CDR. */
export const FILTROS_ESTADO: ReadonlyArray<{
  value: EstadoCdrDemo | 'TODOS';
  label: string;
}> = [
  { value: 'TODOS', label: 'Todos los estados' },
  { value: 'ACEPTADO', label: 'Aceptado' },
  { value: 'OBSERVADO', label: 'Observado (4xxx)' },
  { value: 'EN_COLA', label: 'En Cola Outbox' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'SIN_CONFIRMAR', label: 'Incertidumbre de transporte' },
];

export interface InvoiceFiltros {
  busqueda: string;
  estado: EstadoCdrDemo | 'TODOS';
  desde: string;
  hasta: string;
}

interface InvoiceFiltersBarProps {
  filtros: InvoiceFiltros;
  onFiltrosChange: (filtros: InvoiceFiltros) => void;
  onActualizar: () => void;
  actualizando?: boolean;
  onEmitir: (tipo: TipoEmision) => void;
}

export const InvoiceFiltersBar = ({
  filtros,
  onFiltrosChange,
  onActualizar,
  actualizando = false,
  onEmitir,
}: InvoiceFiltersBarProps) => {
  const [menuAbierto, setMenuAbierto] = useState(false);

  const set = (parcial: Partial<InvoiceFiltros>) =>
    onFiltrosChange({ ...filtros, ...parcial });

  const emitir = (tipo: TipoEmision) => {
    setMenuAbierto(false);
    onEmitir(tipo);
  };

  return (
    <FilterBar>
      <FilterItem className="min-w-[240px]">
        <FilterSearch
          value={filtros.busqueda}
          onChange={(valor) => set({ busqueda: valor })}
          onClear={() => set({ busqueda: '' })}
          placeholder="Buscar por RUC/DNI o serie-correlativo..."
          aria-label="Buscar comprobantes"
        />
      </FilterItem>

      <FilterItem className="min-w-[180px]">
        <Select
          value={filtros.estado}
          onValueChange={(valor) =>
            set({ estado: valor as InvoiceFiltros['estado'] })
          }
        >
          <SelectTrigger aria-label="Filtrar por estado CDR">
            <SelectValue placeholder="Estado CDR" />
          </SelectTrigger>
          <SelectContent>
            {FILTROS_ESTADO.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterItem>

      <FilterItem className="max-w-[160px] flex-none">
        <PageField label="Desde" htmlFor="filtro-desde">
          <Input
            id="filtro-desde"
            type="date"
            value={filtros.desde}
            onChange={(e) => set({ desde: e.target.value })}
          />
        </PageField>
      </FilterItem>

      <FilterItem className="max-w-[160px] flex-none">
        <PageField label="Hasta" htmlFor="filtro-hasta">
          <Input
            id="filtro-hasta"
            type="date"
            value={filtros.hasta}
            onChange={(e) => set({ hasta: e.target.value })}
          />
        </PageField>
      </FilterItem>

      <FilterItem className="flex-none">
        <Button variant="outline" size="sm" disabled={actualizando} onClick={onActualizar}>
          <RefreshCw aria-hidden="true" />
          {actualizando ? 'Actualizando…' : 'Actualizar'}
        </Button>

        <InvoiceEmitMenu
          abierto={menuAbierto}
          onToggle={() => setMenuAbierto((prev) => !prev)}
          onEmitir={emitir}
        />
      </FilterItem>
    </FilterBar>
  );
};

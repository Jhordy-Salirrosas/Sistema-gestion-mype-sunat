import { errorRangoFechas } from '../lib/invoiceDateRange';
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
  ultimaActualizacion?: string | null;
  onEmitir: (tipo: TipoEmision) => void;
}

export const InvoiceFiltersBar = ({
  filtros,
  onFiltrosChange,
  onActualizar,
  actualizando = false,
  ultimaActualizacion,
  onEmitir,
}: InvoiceFiltersBarProps) => {
  const [menuAbierto, setMenuAbierto] = useState(false);

  const [draft, setDraft] = useState<{baseDesde: string; baseHasta: string; desde: string; hasta: string} | null>(null);
  const fechas = draft?.baseDesde === filtros.desde && draft?.baseHasta === filtros.hasta ? draft : filtros;
  const errorFechas = errorRangoFechas(fechas.desde, fechas.hasta);
  const set = (parcial: Partial<InvoiceFiltros>) => onFiltrosChange({ ...filtros, ...parcial });
  const cambiarFecha = (parcial: Partial<Pick<InvoiceFiltros, 'desde' | 'hasta'>>) => {
    const nuevas = {desde: fechas.desde, hasta: fechas.hasta, ...parcial};
    setDraft({baseDesde: filtros.desde, baseHasta: filtros.hasta, ...nuevas});
    if (!errorRangoFechas(nuevas.desde, nuevas.hasta)) onFiltrosChange({...filtros, ...nuevas});
  };

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
            value={fechas.desde}
            onChange={(e) => cambiarFecha({ desde: e.target.value })}
          />
        </PageField>
      </FilterItem>

      <FilterItem className="max-w-[160px] flex-none">
        <PageField label="Hasta" htmlFor="filtro-hasta">
          <Input
            id="filtro-hasta"
            type="date"
            value={fechas.hasta}
            onChange={(e) => cambiarFecha({ hasta: e.target.value })}
          />
        </PageField>
      </FilterItem>

      {errorFechas && <p role="alert" className="text-xs text-destructive">{errorFechas}</p>}
      <FilterItem className="flex-none">
        <Button variant="outline" size="sm" disabled={actualizando || Boolean(errorFechas)} onClick={onActualizar}>
          <RefreshCw aria-hidden="true" />
          {actualizando ? 'Actualizando…' : 'Actualizar'}
        </Button>

        {ultimaActualizacion && <span className="text-xs text-muted-foreground">Actualizado a las {ultimaActualizacion}</span>}

        <InvoiceEmitMenu
          abierto={menuAbierto}
          onToggle={() => setMenuAbierto((prev) => !prev)}
          onEmitir={emitir}
        />
      </FilterItem>
    </FilterBar>
  );
};

import { CATALOGO_59_MEDIOS_PAGO, type MedioPagoDetraccion } from '../lib/medioPagoDetraccion';

export const MedioPagoDetraccionSelect = ({ aplica, value, onChange }: {
  aplica: boolean; value?: MedioPagoDetraccion | ''; onChange: (value: MedioPagoDetraccion | '') => void;
}) => aplica ? <label className="grid gap-2 text-sm">
  Medio de pago de la detracción
  <select required value={value ?? ''} onChange={(e) => onChange(e.target.value as MedioPagoDetraccion | '')}
    className="h-9 w-full rounded-md border bg-background px-3 text-sm">
    <option value="">Seleccione un medio de pago</option>
    {Object.entries(CATALOGO_59_MEDIOS_PAGO).sort(([a], [b]) => a.localeCompare(b)).map(([codigo, descripcion]) =>
      <option key={codigo} value={codigo}>{codigo} - {descripcion}</option>)}
  </select>
</label> : null;

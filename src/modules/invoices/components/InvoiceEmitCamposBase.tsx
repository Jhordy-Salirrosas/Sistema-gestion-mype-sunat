/**
 * Primitivos de formulario para el modal de emisión (M1).
 *
 * Envoltorios delgados sobre los primitivos de `@/components/ui` que evitan
 * repetir el marcado de etiqueta, input y select en cada campo.
 */
import {
  PageField,
  PageText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';

export const CLASE_INPUT = 'h-9 rounded-md border bg-background px-3 text-sm';

export interface CampoTextoProps {
  id: string;
  label: string;
  value: string | number;
  onChange: (valor: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  error?: string;
  ayuda?: string;
}

/** Input de texto/número con etiqueta, ayuda y error opcionales. */
export const CampoTexto = ({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  ayuda,
}: CampoTextoProps) => (
  <PageField label={label} htmlFor={id}>
    <input
      id={id}
      type={type}
      min={type === 'number' ? '0' : undefined}
      className={CLASE_INPUT}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
    {ayuda && <PageText variant="caption">{ayuda}</PageText>}
    {error && <PageText variant="error">{error}</PageText>}
  </PageField>
);

export interface OpcionSelect<T extends string> {
  value: T;
  label: string;
}


/**
 * Input de fecha (`YYYY-MM-DD`) con etiqueta, ayuda y error.
 *
 * `CampoTexto` no sirve para esto: aceptar `type="date"` haría que cualquiera
 * de los campos de texto pudiera volverse un calendario sin que el `value` y el
 * `min`/`max` tengan sentido. Se separa para que el tope de la fecha de
 * emisión (no futura, no anterior al plazo del resumen) viva en un solo sitio.
 */
export const CampoFecha = ({
  id,
  label,
  value,
  onChange,
  min,
  max,
  ayuda,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  min?: string;
  max?: string;
  ayuda?: string;
  error?: string;
}) => (
  <PageField label={label} htmlFor={id}>
    <input
      id={id}
      type="date"
      min={min}
      max={max}
      className={CLASE_INPUT}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    {ayuda && <PageText variant="caption">{ayuda}</PageText>}
    {error && <PageText variant="error">{error}</PageText>}
  </PageField>
);

export interface CampoSelectProps<T extends string> {
  id: string;
  label: string;
  value: T | string;
  onChange: (valor: string) => void;
  opciones: readonly OpcionSelect<T>[];
  disabled?: boolean;
}

/** Select con etiqueta construido sobre los primitivos de `@/components/ui`. */
export const CampoSelect = <T extends string>({
  id,
  label,
  value,
  onChange,
  opciones,
  disabled = false,
}: CampoSelectProps<T>) => (
  <PageField label={label} htmlFor={id}>
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </PageField>
);
